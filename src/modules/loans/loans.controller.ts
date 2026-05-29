import {
  Controller, Get, Post, Patch,
  Param, Body, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loans.dto';
import { LoanStatus } from '@modules/loans/entities/loan.entity';


@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private loansService: LoansService) {}

  @Post()
  create(@Body() dto: CreateLoanDto) {
    return this.loansService.create(dto);
  }

  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'itemId', required: false })
  @ApiQuery({ name: 'status', enum: LoanStatus, required: false })
  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('itemId') itemId?: string,
    @Query('status') status?: LoanStatus,
  ) {
    return this.loansService.findAll({ userId, itemId, status });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.loansService.findOne(id);
  }

  @Patch(':id/return')
  returnLoan(@Param('id', ParseUUIDPipe) id: string) {
    return this.loansService.returnLoan(id);
  }

  @Patch(':id/mark-lost')
  markLost(@Param('id', ParseUUIDPipe) id: string) {
    return this.loansService.markLost(id);
  }
}
