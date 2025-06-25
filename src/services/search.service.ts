import { Injectable, Logger } from '@nestjs/common';
const Fuse = require('fuse.js');
import { CompanyData, CompanyMatch, MatchScore } from '../interfaces/company.interface';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private companies: CompanyData[] = [];
  private fuseInstance: any | null = null;

  initializeIndex(companies: CompanyData[]): void {
    this.companies = companies;
    
    const fuseOptions: any = {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      keys: [
        { name: 'company_commercial_name', weight: 0.4 },
        { name: 'company_legal_name', weight: 0.3 },
        { name: 'company_all_available_names', weight: 0.3 },
        { name: 'domain', weight: 0.8 },
        { name: 'phone_numbers', weight: 0.9 },
        { name: 'social_media_links.facebook', weight: 0.7 }
      ]
    };

    this.fuseInstance = new Fuse(companies, fuseOptions);
    this.logger.log(`Search index initialized with ${companies.length} companies`);
  }

  searchCompany(params: {
    name?: string;
    website?: string;
    phone?: string;
    facebook?: string;
  }): CompanyMatch | null {
    if (!this.fuseInstance) {
      throw new Error('Search index not initialized');
    }

    const searchStrategies = [
      this.exactDomainMatch.bind(this),
      this.exactPhoneMatch.bind(this),
      this.exactFacebookMatch.bind(this),
      this.fuzzyNameMatch.bind(this),
      this.combinedMatch.bind(this)
    ];

    for (const strategy of searchStrategies) {
      const result = strategy(params);
      if (result && result.match_score.score >= 0.7) {
        return result;
      }
    }

    return this.getBestMatch(params);
  }

  private exactDomainMatch(params: { website?: string }): CompanyMatch | null {
    if (!params.website) return null;

    const domain = this.normalizeDomain(params.website);
    const company = this.companies.find(c => 
      this.normalizeDomain(c.domain) === domain
    );

    if (company) {
      return {
        company,
        match_score: {
          score: 1.0,
          matched_fields: ['domain'],
          confidence: 'high'
        }
      };
    }

    return null;
  }

  private exactPhoneMatch(params: { phone?: string }): CompanyMatch | null {
    if (!params.phone) return null;

    const normalizedPhone = this.normalizePhone(params.phone);
    const company = this.companies.find(c => 
      c.phone_numbers?.some(phone => 
        this.normalizePhone(phone) === normalizedPhone
      )
    );

    if (company) {
      return {
        company,
        match_score: {
          score: 0.95,
          matched_fields: ['phone'],
          confidence: 'high'
        }
      };
    }

    return null;
  }

  private exactFacebookMatch(params: { facebook?: string }): CompanyMatch | null {
    if (!params.facebook) return null;

    const normalizedFb = this.normalizeFacebookUrl(params.facebook);
    const company = this.companies.find(c => 
      c.social_media_links?.facebook && 
      this.normalizeFacebookUrl(c.social_media_links.facebook) === normalizedFb
    );

    if (company) {
      return {
        company,
        match_score: {
          score: 0.9,
          matched_fields: ['facebook'],
          confidence: 'high'
        }
      };
    }

    return null;
  }

  private fuzzyNameMatch(params: { name?: string }): CompanyMatch | null {
    if (!params.name) return null;

    const results = this.fuseInstance!.search(params.name);
    if (results.length > 0 && results[0].score! <= 0.3) {
      const company = results[0].item;
      return {
        company,
        match_score: {
          score: 1 - results[0].score!,
          matched_fields: ['name'],
          confidence: results[0].score! <= 0.1 ? 'high' : 'medium'
        }
      };
    }

    return null;
  }

  private combinedMatch(params: {
    name?: string;
    website?: string;
    phone?: string;
    facebook?: string;
  }): CompanyMatch | null {
    const searchQuery = [
      params.name,
      params.website && this.normalizeDomain(params.website),
      params.phone,
      params.facebook
    ].filter(Boolean).join(' ');

    if (!searchQuery) return null;

    const results = this.fuseInstance!.search(searchQuery);
    if (results.length > 0) {
      const company = results[0].item;
      const matchedFields = this.determineMatchedFields(params, company);
      const score = this.calculateCombinedScore(params, company, results[0].score!);

      return {
        company,
        match_score: {
          score,
          matched_fields: matchedFields,
          confidence: score >= 0.8 ? 'high' : score >= 0.6 ? 'medium' : 'low'
        }
      };
    }

    return null;
  }

  private getBestMatch(params: {
    name?: string;
    website?: string;
    phone?: string;
    facebook?: string;
  }): CompanyMatch | null {
    const searchQuery = Object.values(params).filter(Boolean).join(' ');
    if (!searchQuery) return null;

    const results = this.fuseInstance!.search(searchQuery);
    if (results.length > 0) {
      const company = results[0].item;
      const matchedFields = this.determineMatchedFields(params, company);
      const score = Math.max(0.1, 1 - results[0].score!);

      return {
        company,
        match_score: {
          score,
          matched_fields: matchedFields,
          confidence: 'low'
        }
      };
    }

    return null;
  }

  private normalizeDomain(domain: string): string {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d]/g, '').replace(/^1/, '');
  }

  private normalizeFacebookUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase()
      .replace('facebook.com/', '')
      .replace('fb.com/', '');
  }

  private determineMatchedFields(
    params: { name?: string; website?: string; phone?: string; facebook?: string },
    company: CompanyData
  ): string[] {
    const matched: string[] = [];

    if (params.website && company.domain) {
      if (this.normalizeDomain(params.website) === this.normalizeDomain(company.domain)) {
        matched.push('domain');
      }
    }

    if (params.phone && company.phone_numbers) {
      const normalizedInput = this.normalizePhone(params.phone);
      if (company.phone_numbers.some(p => this.normalizePhone(p) === normalizedInput)) {
        matched.push('phone');
      }
    }

    if (params.facebook && company.social_media_links?.facebook) {
      if (this.normalizeFacebookUrl(params.facebook) === 
          this.normalizeFacebookUrl(company.social_media_links.facebook)) {
        matched.push('facebook');
      }
    }

    if (params.name) {
      const names = [
        company.company_commercial_name,
        company.company_legal_name,
        company.company_all_available_names
      ].filter(Boolean);
      
      if (names.some(name => this.isNameSimilar(params.name!, name!))) {
        matched.push('name');
      }
    }

    return matched;
  }

  private isNameSimilar(input: string, target: string): boolean {
    const normalizeForComparison = (str: string) => 
      str.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizedInput = normalizeForComparison(input);
    const normalizedTarget = normalizeForComparison(target);

    if (normalizedInput === normalizedTarget) return true;

    if (normalizedInput.includes(normalizedTarget) || normalizedTarget.includes(normalizedInput)) {
      return true;
    }

    const inputWords = normalizedInput.split(' ');
    const targetWords = normalizedTarget.split(' ');
    const overlap = inputWords.filter(word => targetWords.includes(word)).length;
    
    return overlap >= Math.min(inputWords.length, targetWords.length) * 0.5;
  }

  private calculateCombinedScore(
    params: { name?: string; website?: string; phone?: string; facebook?: string },
    company: CompanyData,
    fuseScore: number
  ): number {
    let score = 1 - fuseScore;
    let weightSum = 1;

    if (params.website && company.domain) {
      if (this.normalizeDomain(params.website) === this.normalizeDomain(company.domain)) {
        score += 0.3;
        weightSum += 0.3;
      }
    }

    if (params.phone && company.phone_numbers) {
      const normalizedInput = this.normalizePhone(params.phone);
      if (company.phone_numbers.some(p => this.normalizePhone(p) === normalizedInput)) {
        score += 0.25;
        weightSum += 0.25;
      }
    }

    if (params.facebook && company.social_media_links?.facebook) {
      if (this.normalizeFacebookUrl(params.facebook) === 
          this.normalizeFacebookUrl(company.social_media_links.facebook)) {
        score += 0.2;
        weightSum += 0.2;
      }
    }

    return Math.min(1.0, score / weightSum);
  }

  getIndexStats(): { total_companies: number; indexed: boolean } {
    return {
      total_companies: this.companies.length,
      indexed: this.fuseInstance !== null
    };
  }
} 