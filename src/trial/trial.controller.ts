// import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post} from "@nestjs/common";
// import {TrialService} from "./trial.service";
// import {CreateLineDto} from "./dto/create-line.dto";
// import {UpdateLineDto} from "./dto/update-line.dto";
//
// @Controller('trial')
// export class TrialController {
//  constructor(private readonly trialService: TrialService) {}
//
//     @Post()
//     async addLine(@Body() CreateLineDto: CreateLineDto) {
//         await this.trialService.addLine(CreateLineDto);
//     }
//
//     @Get()
//     async getAllLines() {
//         return this.trialService.getAllLines();
//     }
//
//     @Get(':lineNumber')
//     async getOneLine(@Param('lineNumber', ParseIntPipe) lineNumber: number) {
//         return this.trialService.getOneLine(lineNumber);
//     }
//
//     @Patch(':lineNumber')
//     async updateLine(
//         @Param('lineNumber', ParseIntPipe) lineNumber: number,
//         @Body() dto: UpdateLineDto,
//     ) {
//         return this.trialService.updateLine(lineNumber, dto);
//     }
//
//     @Delete(':lineNumber')
//     async deleteLine(@Param('lineNumber', ParseIntPipe) lineNumber: number) {
//         return this.trialService.deleteLine(lineNumber);
//     }
// }