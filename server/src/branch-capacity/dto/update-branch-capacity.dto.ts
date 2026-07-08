import { IsInt, Min } from 'class-validator';

export class UpdateBranchCapacityDto {
  @IsInt()
  @Min(0)
  singleCap: number | undefined;

  @IsInt()
  @Min(0)
  doubleCap: number | undefined;
}
