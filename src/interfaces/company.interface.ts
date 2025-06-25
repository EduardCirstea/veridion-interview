export interface CompanyData {
  domain: string;
  company_commercial_name?: string;
  company_legal_name?: string;
  company_all_available_names?: string;
  phone_numbers?: string[];
  social_media_links?: SocialMediaLinks;
  address?: string;
  location?: string;
}

export interface SocialMediaLinks {
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  youtube?: string;
  other?: string[];
}

export interface ScrapedData {
  domain: string;
  phone_numbers: string[];
  social_media_links: SocialMediaLinks;
  address?: string;
  location?: string;
  crawl_success: boolean;
  crawl_duration_ms: number;
  error_message?: string;
}

export interface AnalyticsData {
  total_websites: number;
  successfully_crawled: number;
  coverage_percentage: number;
  fill_rates: {
    phone_numbers: number;
    social_media: number;
    address: number;
  };
  total_processing_time_ms: number;
}

export interface MatchScore {
  score: number;
  matched_fields: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface CompanyMatch {
  company: CompanyData;
  match_score: MatchScore;
} 