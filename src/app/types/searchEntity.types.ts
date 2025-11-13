export interface SearchEntity {
  pnx: PNX;
}

export interface PNX {
  addata: AdData;
  display: Display;
  control?: Control;
}

export interface Display {
  title: string[];
  type: string[];
  oa?: string[];
}

export interface AdData {
  issn?: string[];
  eissn?: string[];
  doi?: string[];
}

export interface Control {
  recordid: string[];
}
