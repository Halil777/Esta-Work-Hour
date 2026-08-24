export type ParsedWorkerImportRow = {
  rowNumber: number;
  workerId: string;
  name: string;
  profession: string;
  brigadeName: string;
  mesaiSistemi: string;
  phone: string;
  hireDate: string;
  isSectionChief: boolean;
  isForeman: boolean;
  fields: Record<string, any>;
};
