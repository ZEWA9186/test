interface IDefaultTask {
  name: string;
  label: string;
  comment: string;
  required?: boolean;
  allowSpace?: boolean;
}

export const TASK: IDefaultTask[] = [
  { name: 'gtin', label: 'GTIN продукта', comment: 'GTIN', required: true },
  {
    name: 'name',
    label: 'Название продукта',
    comment: 'название отображаемое в окне программы для оператора',
    required: true,
  },

  {
    name: 'description',
    label: 'Описание продукта',
    comment: 'Описание продукта',
    allowSpace: true,
  },
  {
    name: 'smallBoxLabel',
    label: 'Название шаблона этикетки малого короба',
    comment: 'Название шаблона этикетки малого короба.',
    required: false,
  },
  {
    name: 'bigBoxLabel',
    label: 'Название шаблона этикетки большого короба',
    comment: 'Название шаблона этикетки большого короба.',
    required: true,
  },
  {
    name: 'palletLabel',
    label: 'Название шаблона этикетки паллеты',
    comment: 'Название шаблона этикетки паллеты.',
    required: true,
  },
  { name: 'gost', label: 'ГОСТ', comment: 'ГОСТ', allowSpace: true },
  {
    name: 'nettoUnit',
    label: 'Нетто одной единицы',
    comment: 'Вес нетто одной единицы продукта в граммах',
    allowSpace: true,
  },
  {
    name: 'bruttoUnit',
    label: 'Брутто одной единицы',
    comment: 'Вес брутто одной единицы продукта в граммах.',
    allowSpace: true,
  },
  {
    name: 'adInfo1',
    label: 'Дополнительная информация1',
    comment: 'Дополнительная динамическая информация, текстовая1',
    allowSpace: true,
  },
  { name: 'batch', label: 'Партия', comment: '', required: true },
  {
    name: 'dateManufacture',
    label: 'Дата начала срока годности',
    comment: '',
    required: true,
  },
  {
    name: 'docId',
    label: 'Идентификатор документа 1С',
    comment: 'Идентификатор документа, который присылает 1С',
    required: true,
  },
  { name: 'ITF14', label: 'ITF-14', comment: 'ITF-14', required: true },
  { name: 'EAN13', label: 'EAN-13', comment: 'EAN-13', required: true },
  { name: 'bruttoBox', label: 'Брутто короба', comment: 'Вес брутто короба', required: true },
  { name: 'packer', label: 'Упаковщик', comment: 'Упаковщик', allowSpace: true },
  {
    name: 'dateExpiration',
    label: 'Дата окончания срока годности',
    comment: '',
    required: true,
  },
  {
    name: 'piecesPerSmallBox',
    label: 'Количество продуктов в малой коробе',
    comment: '',
    required: false,
  },
  {
    name: 'piecesPerBigBox',
    label: 'Количество коробов в большой коробке',
    comment: '',
    required: true,
  },
  {
    name: 'piecesPerPallet',
    label: 'Количество в паллете',
    comment: '',
    required: true,
  },
  {
    name: 'aggregationLvl',
    label: 'Уровень агрегации',
    comment: '',
    required: true,
  },
  {
    name: 'codes',
    label: 'Коды маркировки',
    comment: 'Массив кодов маркировки',
    required: true,
  },
];
