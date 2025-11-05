import { IsInt, Min } from 'class-validator';

export class UpdateBranchCapacityDto {
  @IsInt()
  @Min(0)
  singleCap: number;

  @IsInt()
  @Min(0)
  doubleCap: number;
}
