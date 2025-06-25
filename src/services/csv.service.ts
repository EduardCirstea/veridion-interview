import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import * as path from 'path';
import { CompanyData } from '../interfaces/company.interface';

@Injectable()
export class CsvService {
  private readonly csvPath = path.join(process.cwd(), 'src', 'csv');

  async loadWebsites(): Promise<string[]> {
    return this.readCsvFile<{ domain: string }>('sample-websites.csv')
      .then(rows => rows.map(row => row.domain));
  }

  async loadCompanyNames(): Promise<CompanyData[]> {
    const rows = await this.readCsvFile<{
      domain: string;
      company_commercial_name: string;
      company_legal_name: string;
      company_all_available_names: string;
    }>('sample-websites-company-names.csv');

    return rows.map(row => ({
      domain: row.domain,
      company_commercial_name: row.company_commercial_name || undefined,
      company_legal_name: row.company_legal_name || undefined,
      company_all_available_names: row.company_all_available_names || undefined,
    }));
  }

  async loadApiInputSample(): Promise<Array<{
    input_name?: string;
    input_phone?: string;
    input_website?: string;
    input_facebook?: string;
  }>> {
    return this.readCsvFile<{
      'input name': string;
      'input phone': string;
      'input website': string;
      'input_facebook': string;
    }>('API-input-sample.csv').then(rows => 
      rows.map(row => ({
        input_name: row['input name'] || undefined,
        input_phone: row['input phone'] || undefined,
        input_website: row['input website'] || undefined,
        input_facebook: row['input_facebook'] || undefined,
      }))
    );
  }

  private readCsvFile<T>(filename: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const results: T[] = [];
      const filePath = path.join(this.csvPath, filename);

      if (!fs.existsSync(filePath)) {
        reject(new Error(`CSV file not found: ${filePath}`));
        return;
      }

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }
} 