import { Controller, Get, Post, Query, Body, HttpStatus, HttpException } from '@nestjs/common';
import { CompanyService } from '../services/company.service';
import { CompanySearchDto, CompanySearchResponseDto, AnalyticsResponseDto } from '../dto/company-search.dto';

@Controller('api/companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('search')
  async searchCompany(@Body() searchDto: CompanySearchDto): Promise<CompanySearchResponseDto> {
    try {
      const result = this.companyService.searchCompany({
        name: searchDto.name,
        website: searchDto.website,
        phone: searchDto.phone,
        facebook: searchDto.facebook
      });

      if (!result) {
        throw new HttpException('No company found matching the criteria', HttpStatus.NOT_FOUND);
      }

      return {
        company: result.company,
        match_score: result.match_score
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Search failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('search')
  async searchCompanyGet(
    @Query('name') name?: string,
    @Query('website') website?: string,
    @Query('phone') phone?: string,
    @Query('facebook') facebook?: string
  ): Promise<CompanySearchResponseDto> {
    try {
      const result = this.companyService.searchCompany({
        name,
        website,
        phone,
        facebook
      });

      if (!result) {
        throw new HttpException('No company found matching the criteria', HttpStatus.NOT_FOUND);
      }

      return {
        company: result.company,
        match_score: result.match_score
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Search failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('scrape')
  async startScraping(): Promise<{ message: string; analytics: AnalyticsResponseDto }> {
    try {
      const result = await this.companyService.startScraping();
      return {
        message: result.message,
        analytics: result.analytics
      };
    } catch (error) {
      throw new HttpException(
        `Scraping failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('analytics')
  async getAnalytics(): Promise<AnalyticsResponseDto | { message: string }> {
    const analytics = this.companyService.getAnalytics();
    
    if (!analytics) {
      return { message: 'Analytics not available. Run scraping first.' };
    }

    return analytics;
  }

  @Get('status')
  async getStatus(): Promise<{
    initialized: boolean;
    companies_count: number;
    scraped_data_count: number;
    analytics_available: boolean;
    index_stats: any;
  }> {
    return this.companyService.getServiceStatus();
  }

  @Post('test')
  async testWithApiSample(): Promise<{
    total_tests: number;
    successful_matches: number;
    match_rate: number;
    sample_results: Array<{
      input: any;
      match_found: boolean;
      match_score?: number;
      match_confidence?: string;
      matched_fields?: string[];
    }>;
  }> {
    try {
      const result = await this.companyService.testWithApiSample();
      
      const sampleResults = result.results.slice(0, 10).map(r => ({
        input: r.input,
        match_found: r.found,
        match_score: r.match?.match_score.score,
        match_confidence: r.match?.match_score.confidence,
        matched_fields: r.match?.match_score.matched_fields
      }));

      return {
        total_tests: result.total_tests,
        successful_matches: result.successful_matches,
        match_rate: result.match_rate,
        sample_results: sampleResults
      };
    } catch (error) {
      throw new HttpException(
        `Testing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('test/full')
  async getFullTestResults(): Promise<{
    total_tests: number;
    successful_matches: number;
    match_rate: number;
    results: Array<{
      input: any;
      match: any;
      found: boolean;
    }>;
  }> {
    try {
      return await this.companyService.testWithApiSample();
    } catch (error) {
      throw new HttpException(
        `Testing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('debug/company/:domain')
  async getCompanyByDomain(@Query('domain') domain: string) {
    const company = this.companyService.getCompanyByDomain(domain);
    if (!company) {
      throw new HttpException('Company not found', HttpStatus.NOT_FOUND);
    }
    return company;
  }

  @Get('debug/all')
  async getAllCompanies() {
    return {
      count: this.companyService.getAllCompanies().length,
      companies: this.companyService.getAllCompanies().slice(0, 10) 
    };
  }
} 