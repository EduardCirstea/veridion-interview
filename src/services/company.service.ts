import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CsvService } from './csv.service';
import { ScraperService } from './scraper.service';
import { SearchService } from './search.service';
import { CompanyData, ScrapedData, AnalyticsData, CompanyMatch } from '../interfaces/company.interface';

@Injectable()
export class CompanyService implements OnModuleInit {
  private readonly logger = new Logger(CompanyService.name);
  private companies: CompanyData[] = [];
  private scrapedData: ScrapedData[] = [];
  private analytics: AnalyticsData | null = null;
  private isInitialized = false;

  constructor(
    private readonly csvService: CsvService,
    private readonly scraperService: ScraperService,
    private readonly searchService: SearchService
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Company Service...');
    await this.initializeData();
  }

  private async initializeData(): Promise<void> {
    try {
      const companyNames = await this.csvService.loadCompanyNames();
      this.logger.log(`Loaded ${companyNames.length} company profiles`);

      this.companies = companyNames;
      this.searchService.initializeIndex(this.companies);
      
      this.isInitialized = true;
      this.logger.log('Company service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize company service', error);
      throw error;
    }
  }

  async startScraping(): Promise<{ message: string; analytics: AnalyticsData }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    this.logger.log('Starting web scraping process...');
    
    try {
      const websites = await this.csvService.loadWebsites();
      this.logger.log(`Scraping ${websites.length} websites`);

      const result = await this.scraperService.scrapeWebsites(websites);
      this.scrapedData = result.data;
      this.analytics = result.analytics;

      this.mergeScrapedData();

      this.searchService.initializeIndex(this.companies);

      this.logger.log('Scraping completed successfully');
      return {
        message: 'Scraping completed successfully',
        analytics: this.analytics
      };
    } catch (error) {
      this.logger.error('Scraping failed', error);
      throw error;
    }
  }

  searchCompany(params: {
    name?: string;
    website?: string;
    phone?: string;
    facebook?: string;
  }): CompanyMatch | null {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    this.logger.debug(`Searching for company with params:`, params);
    return this.searchService.searchCompany(params);
  }

  getAnalytics(): AnalyticsData | null {
    return this.analytics;
  }

  getServiceStatus(): {
    initialized: boolean;
    companies_count: number;
    scraped_data_count: number;
    analytics_available: boolean;
    index_stats: any;
  } {
    return {
      initialized: this.isInitialized,
      companies_count: this.companies.length,
      scraped_data_count: this.scrapedData.length,
      analytics_available: this.analytics !== null,
      index_stats: this.searchService.getIndexStats()
    };
  }

  async testWithApiSample(): Promise<{
    total_tests: number;
    successful_matches: number;
    match_rate: number;
    results: Array<{
      input: any;
      match: CompanyMatch | null;
      found: boolean;
    }>;
  }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const testInputs = await this.csvService.loadApiInputSample();
    const results: Array<{
      input: any;
      match: CompanyMatch | null;
      found: boolean;
    }> = [];

    for (const input of testInputs) {
      const match = this.searchCompany({
        name: input.input_name,
        website: input.input_website,
        phone: input.input_phone,
        facebook: input.input_facebook
      });

      results.push({
        input,
        match,
        found: match !== null
      });
    }

    const successfulMatches = results.filter(r => r.found).length;

    return {
      total_tests: testInputs.length,
      successful_matches: successfulMatches,
      match_rate: (successfulMatches / testInputs.length) * 100,
      results
    };
  }

  private mergeScrapedData(): void {
    this.logger.log('Merging scraped data with company profiles...');

    const scrapedDataMap = new Map<string, ScrapedData>();
    this.scrapedData.forEach(data => {
      scrapedDataMap.set(data.domain, data);
    });

    this.companies = this.companies.map(company => {
      const scraped = scrapedDataMap.get(company.domain);
      if (scraped && scraped.crawl_success) {
        return {
          ...company,
          phone_numbers: this.mergePhoneNumbers(company.phone_numbers, scraped.phone_numbers),
          social_media_links: this.mergeSocialMediaLinks(company.social_media_links, scraped.social_media_links),
          address: company.address || scraped.address,
          location: company.location || scraped.location
        };
      }
      return company;
    });

    this.logger.log(`Merged data for ${this.companies.length} companies`);
  }

  private mergePhoneNumbers(existing?: string[], scraped?: string[]): string[] {
    const phones = new Set<string>();
    
    if (existing) {
      existing.forEach(phone => phones.add(phone));
    }
    
    if (scraped) {
      scraped.forEach(phone => phones.add(phone));
    }
    
    return Array.from(phones);
  }

  private mergeSocialMediaLinks(existing?: any, scraped?: any): any {
    return {
      facebook: existing?.facebook || scraped?.facebook,
      twitter: existing?.twitter || scraped?.twitter,
      linkedin: existing?.linkedin || scraped?.linkedin,
      instagram: existing?.instagram || scraped?.instagram,
      youtube: existing?.youtube || scraped?.youtube,
      other: [
        ...(existing?.other || []),
        ...(scraped?.other || [])
      ].filter((value, index, self) => self.indexOf(value) === index)
    };
  }

  getCompanyByDomain(domain: string): CompanyData | undefined {
    return this.companies.find(c => c.domain === domain);
  }

  getAllCompanies(): CompanyData[] {
    return this.companies;
  }
} 