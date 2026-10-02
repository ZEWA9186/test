// task-mapper.helper.ts
import { DeepPartial } from 'typeorm';
import { TaskEntity } from '../task/entities/task.entity';


export function map1sJsonToTaskEntity(
    json: Record<string, any>,
    rawCodes?: string[],
): DeepPartial<TaskEntity> {
    const codesArray: string[] = rawCodes ?? json.codes ?? [];

    return {
        gtin: json.gtin,
        name: json.name,
        description: json.description,
        ITF14: json.ITF14 ?? json.itf_14,

        labelBox: json.label_box ?? json.labelBox,
        labelPallet: json.label_pallet ?? json.labelPallet,
        inscriptionLabel: json.inscription_label ?? json.inscriptionLabel,

        techConditions: json.tech_conditions ?? json.techConditions,
        gost: json.gost,
        otherTechConditions: json.other_tech_conditions ?? json.otherTechConditions,

        nettoUnit: json.netto_unit ?? json.nettoUnit,
        bruttoUnit: json.brutto_unit ?? json.bruttoUnit,
        bruttoBox: json.brutto_box ?? json.bruttoBox,

        tempCond1: json.temp_cond_1 ?? json.tempCond1,
        tempCond2: json.temp_cond_2 ?? json.tempCond2,
        tempCond3: json.temp_cond_3 ?? json.tempCond3,
        tempCond4: json.temp_cond_4 ?? json.tempCond4,

        adInfo1: json.ad_info_1 ?? json.adInfo1,
        adInfo2: json.ad_info_2 ?? json.adInfo2,
        adInfo3: json.ad_info_3 ?? json.adInfo3,
        adInfo4: json.ad_info_4 ?? json.adInfo4,
        adInfo5: json.ad_info_5 ?? json.adInfo5,
        adInfo6: json.ad_info_6 ?? json.adInfo6,

        batch: json.batch,
        packer: json.packer,
        date_manufacture: json.date_manufacture,
        date_expiration: json.date_expiration,

        piecesPerSmallBox: json.pieces_per_small_box ?? json.piecesPerSmallBox,
        piecesPerBigBox: json.pieces_per_big_box ?? json.piecesPerBigBox,
        piecesPerPallet: json.pieces_per_pallet ?? json.piecesPerPallet,

        startCorob: json.start_corob ?? json.startCorob,
        startPallet: json.start_pallet ?? json.startPallet,
        workSH: json.work_sh ?? json.workSH,
        aggregationLvl: json.aggregation_lvl ?? json.aggregationLvl,

        tsdIds: json.tsd_ids ?? json.tsdIds,

        codes: codesArray.map((codeStr) => ({ code: codeStr })),
    };
}