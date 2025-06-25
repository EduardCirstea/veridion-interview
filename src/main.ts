import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors();
  
  app.setGlobalPrefix('');
  
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  console.log(`Company Data API is running on: http://localhost:${port}`);

}
bootstrap();
