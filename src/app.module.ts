import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CompanyController } from './controllers/company.controller';
import { CompanyService } from './services/company.service';
import { CsvService } from './services/csv.service';
import { ScraperService } from './services/scraper.service';
import { SearchService } from './services/search.service';

@Module({
  imports: [],
  controllers: [AppController, CompanyController],
  providers: [AppService, CompanyService, CsvService, ScraperService, SearchService],
})
export class AppModule {}
