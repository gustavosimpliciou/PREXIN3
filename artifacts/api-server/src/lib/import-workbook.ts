import ExcelJS from 'exceljs';
import { parseBrazilianNumber } from '@workspace/pricing-engine';
export type ImportedProduct={sheet:string;row:number;name:string;category:string;weight:number|null;brand:string;material:string;priceKg:number|null;additional:number|null;legacyPrices:(number|null)[]};
export type ImportedMaterial={row:number;color:string;material:string;quantity:number|null;priceKg:number|null};
export interface ImportPreview {products:ImportedProduct[];materials:ImportedMaterial[];investments:{name:string;value:number|null}[];errors:string[];}
function cellValue(cell:ExcelJS.Cell):unknown {const v=cell.value;if(v&&typeof v==='object'){if('formula' in v||'sharedFormula' in v)return (v as any).result??null;if('richText' in v)return v.richText.map(x=>x.text).join('');if('text' in v)return v.text;}return v;}
const text=(c:ExcelJS.Cell)=>String(cellValue(c)??'').trim();
export async function parseWorkbook(buffer:Buffer):Promise<ImportPreview>{
  if(buffer.length>5*1024*1024)throw new Error('O arquivo deve ter no máximo 5 MB.');
  // Bound the uncompressed ZIP payload before handing it to the workbook parser.
  let uncompressed=0,entries=0;for(let i=0;i<buffer.length-46;i++)if(buffer.readUInt32LE(i)===0x02014b50){uncompressed+=buffer.readUInt32LE(i+24);entries++;i+=45+buffer.readUInt16LE(i+28)+buffer.readUInt16LE(i+30)+buffer.readUInt16LE(i+32);}
  if(uncompressed>40*1024*1024||entries>10000)throw new Error('Planilha grande demais para importar.');
  const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as any);
  const preview:ImportPreview={products:[],materials:[],investments:[],errors:[]};
  for(const sheet of book.worksheets){if(sheet.rowCount>10000)throw new Error('Cada aba deve ter até 10.000 linhas.');const name=sheet.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    if(name.includes('PRECIFICA'))for(let row=6;row<=sheet.rowCount;row++){const r=sheet.getRow(row),product=text(r.getCell(3));if(!product)continue;
      const weight=parseBrazilianNumber(cellValue(r.getCell(4))),priceKg=parseBrazilianNumber(cellValue(r.getCell(9))),additional=parseBrazilianNumber(cellValue(r.getCell(10)));
      const legacyPrices=[12,13,14].map(c=>parseBrazilianNumber(cellValue(r.getCell(c))));
      preview.products.push({sheet:sheet.name,row,name:product,category:name.includes('DECOR')?'Decorativos':'Diversos',weight,brand:text(r.getCell(7)),material:text(r.getCell(8)),priceKg,additional,legacyPrices});
      if(weight===null||weight<0||priceKg===null||priceKg<0||additional===null||additional<0)preview.errors.push(`${sheet.name}, linha ${row}: revise peso, valor/kg e adicionais.`);
    }
    else if(name.includes('ESTOQUE FILAMENTO'))for(let row=5;row<=sheet.rowCount;row++){const r=sheet.getRow(row),color=text(r.getCell(2));if(color)preview.materials.push({row,color,material:text(r.getCell(3)),quantity:parseBrazilianNumber(cellValue(r.getCell(4))),priceKg:parseBrazilianNumber(cellValue(r.getCell(5)))});}
    else if(name.includes('INVESTIMENTO'))for(let row=4;row<=sheet.rowCount;row++){const r=sheet.getRow(row),n=text(r.getCell(1));if(n)preview.investments.push({name:n,value:parseBrazilianNumber(cellValue(r.getCell(2)))});}
  }
  if(!preview.products.length&&!preview.materials.length)preview.errors.push('Nenhuma aba compatível com a planilha de precificação foi encontrada.');
  return preview;
}
