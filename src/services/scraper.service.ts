import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { ScrapedData, SocialMediaLinks, AnalyticsData } from '../interfaces/company.interface';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private browser: puppeteer.Browser | null = null;

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeWebsites(domains: string[]): Promise<{ data: ScrapedData[], analytics: AnalyticsData }> {
    const startTime = Date.now();
    await this.initBrowser();
    
    const batchSize = 10;
    const results: ScrapedData[] = [];
    
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(domain => this.scrapeSingleWebsite(domain))
      );
      results.push(...batchResults);
      
      this.logger.log(`Processed ${Math.min(i + batchSize, domains.length)}/${domains.length} websites`);
    }

    const endTime = Date.now();
    const analytics = this.calculateAnalytics(results, endTime - startTime);
    
    await this.closeBrowser();
    return { data: results, analytics };
  }

  private async scrapeSingleWebsite(domain: string): Promise<ScrapedData> {
    const startTime = Date.now();
    const result: ScrapedData = {
      domain,
      phone_numbers: [],
      social_media_links: {},
      crawl_success: false,
      crawl_duration_ms: 0
    };

    try {
      const page = await this.browser!.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(10000);

      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const content = await page.content();
      await page.close();

      const $ = cheerio.load(content);
      
      result.phone_numbers = this.extractPhoneNumbers(content);
      result.social_media_links = this.extractSocialMediaLinks($);
      result.address = this.extractAddress($);
      result.crawl_success = true;

    } catch (error) {
      result.error_message = error.message;
      this.logger.warn(`Failed to scrape ${domain}: ${error.message}`);
    }

    result.crawl_duration_ms = Date.now() - startTime;
    return result;
  }

  private extractPhoneNumbers(text: string): string[] {
    const phoneRegexes = [
      /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\+?\d{1,3}[-.\s]?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
      /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g 
    ];

    const phones = new Set<string>();
    
    phoneRegexes.forEach(regex => {
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.replace(/[^\d+]/g, '').replace(/^1/, '');
          if (cleaned.length >= 10) {
            phones.add(match.trim());
          }
        });
      }
    });

    return Array.from(phones);
  }

  private extractSocialMediaLinks($: any): SocialMediaLinks {
    const socialLinks: SocialMediaLinks = { other: [] };
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      const url = href.toLowerCase();
      
      if (url.includes('facebook.com')) {
        socialLinks.facebook = href;
      } else if (url.includes('twitter.com') || url.includes('x.com')) {
        socialLinks.twitter = href;
      } else if (url.includes('linkedin.com')) {
        socialLinks.linkedin = href;
      } else if (url.includes('instagram.com')) {
        socialLinks.instagram = href;
      } else if (url.includes('youtube.com')) {
        socialLinks.youtube = href;
      } else if (this.isSocialMediaLink(url)) {
        socialLinks.other = socialLinks.other || [];
        socialLinks.other.push(href);
      }
    });

    return socialLinks;
  }

  private extractAddress($: any): string | undefined {
    const addressSelectors = [
      '[itemtype*="PostalAddress"]',
      '.address',
      '.location',
      '.contact-address',
      '*[class*="address"]',
      '*[class*="location"]'
    ];

    for (const selector of addressSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = element.text().trim();
        if (text.length > 10 && this.looksLikeAddress(text)) {
          return text;
        }
      }
    }

    const bodyText = $('body').text();
    const addressPattern = /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Plaza|Circle|Cir)[^.]*(?:\d{5})/g;
    const match = bodyText.match(addressPattern);
    
    return match ? match[0].trim() : undefined;
  }

  private isSocialMediaLink(url: string): boolean {
    const socialDomains = [
      'pinterest.com',
      'snapchat.com',
      'tiktok.com',
      'discord.com',
      'reddit.com',
      'tumblr.com',
      'telegram.org'
    ];
    return socialDomains.some(domain => url.includes(domain));
  }

  private looksLikeAddress(text: string): boolean {
    const addressKeywords = ['street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd', 'drive', 'dr', 'suite', 'apt'];
    const hasKeyword = addressKeywords.some(keyword => text.toLowerCase().includes(keyword));
    const hasNumber = /\d/.test(text);
    return hasKeyword && hasNumber;
  }

  private calculateAnalytics(results: ScrapedData[], totalTime: number): AnalyticsData {
    const successfulCrawls = results.filter(r => r.crawl_success);
    const withPhones = results.filter(r => r.phone_numbers.length > 0);
    const withSocial = results.filter(r => Object.keys(r.social_media_links).length > 0);
    const withAddress = results.filter(r => r.address);

    return {
      total_websites: results.length,
      successfully_crawled: successfulCrawls.length,
      coverage_percentage: (successfulCrawls.length / results.length) * 100,
      fill_rates: {
        phone_numbers: (withPhones.length / results.length) * 100,
        social_media: (withSocial.length / results.length) * 100,
        address: (withAddress.length / results.length) * 100
      },
      total_processing_time_ms: totalTime
    };
  }
} 