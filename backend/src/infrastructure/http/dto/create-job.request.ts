import { IsOptional, IsString } from 'class-validator';

export class CreateJobRequest {
  @IsString()
  repoId!: string;

  @IsString()
  filePath!: string;
}
