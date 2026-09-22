import { Body, Controller, Post } from "@nestjs/common";
import { LastPackageService } from "./last-package.service";

@Controller('last-package')
export class LastPackageController {
    constructor(private readonly lastPackageService: LastPackageService) {}

    @Post()
    async addNoteAndTook(@Body() body: { gtin: string; dateTask: string; batchNumber: string }) {
        return await this.lastPackageService.addNoteAndTook(
            body.gtin,
            body.dateTask,
            body.batchNumber
        );
    }

    @Post('update-box')
    async updateBoxNumber(@Body() body: { gtin: any; dateTask: string; boxNumber: number; batchNumber: string}){
        await this.lastPackageService.updateBoxNumber(
            body.gtin,
            body.dateTask,
            body.boxNumber,
            body.batchNumber
        )
    }

    @Post('update-pallet')
    async updatePalletNumber(@Body() body: { gtin: string; dateTask: string; palletNumber: number; batchNumber: string}){
        await this.lastPackageService.updatePalletNumber(
            body.gtin,
            body.dateTask,
            body.palletNumber,
            body.batchNumber
        )
    }
}