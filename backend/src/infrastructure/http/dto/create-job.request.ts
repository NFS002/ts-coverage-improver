import { IsOptional, IsString } from 'class-validator';

export class CreateJobRequest {
  @IsOptional()
  @IsString()
  repoId?: string;

  @IsString()
  @IsOptional()
  @IsString()
  repoUrl?: string;

  @IsString()
  filePath!: string;
}
