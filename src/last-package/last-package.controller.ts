import { Body, Controller, Post } from "@nestjs/common";
import { LastPackageService } from "./last-package.service";

@Controller('last-package')
export class LastPackageController {
    constructor(private readonly lastPackageService: LastPackageService) {}

    @Post('get-box')
    async updateBoxNumber(@Body() body: { gtin: string; dateTask: string; boxNumber: number; batchNumber: string}){
       return await this.lastPackageService.updateBoxNumber(
            body.gtin,
            body.dateTask,
            body.batchNumber
        )
    }

    @Post('get-pallet')
    async updatePalletNumber(@Body() body: { gtin: string; dateTask: string; palletNumber: number; batchNumber: string}){
       return await this.lastPackageService.updatePalletNumber(
            body.gtin,
            body.dateTask,
            body.batchNumber
        )
    }
}