export class CompanySearchDto {
  name?: string;
  phone?: string;
  website?: string;
  facebook?: string;
}

export class CompanySearchResponseDto {
  company: {
    domain: string;
    company_commercial_name?: string;
    company_legal_name?: string;
    company_all_available_names?: string;
    phone_numbers?: string[];
    social_media_links?: {
      facebook?: string;
      twitter?: string;
      linkedin?: string;
      instagram?: string;
      youtube?: string;
      other?: string[];
    };
    address?: string;
    location?: string;
  };
  match_score: {
    score: number;
    matched_fields: string[];
    confidence: 'high' | 'medium' | 'low';
  };
}

export class AnalyticsResponseDto {
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