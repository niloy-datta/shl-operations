/** RFC4180-style CSV parser; no formulas evaluated and no network/storage access. */
export function parseContactCsv(source:string):string[][] {
 if(source.length>1_048_576)throw new Error("CSV must be at most 1 MB.");
 const rows:string[][]=[];let row:string[]=[],field="",quoted=false,closed=false;
 const text=source.replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw new Error("Unexpected quote in CSV field.");quoted=true;continue;}
  if(c===","||c==="\n"||c==="\r"){
   row.push(field);field="";closed=false;
   if(c!==","){if(c==="\r"&&text[i+1]==="\n")i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}
  }else{if(closed&&!/\s/.test(c))throw new Error("Unexpected text after quoted field.");if(!closed)field+=c;}
 }
 if(quoted)throw new Error("Unclosed quoted CSV field.");
 row.push(field);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)throw new Error("Include a header and at least one record.");
 if(rows.length>101)throw new Error("Review at most 100 records per import.");
 if(rows.some(r=>r.length!==rows[0].length))throw new Error("Each row must have the same number of columns as the header.");
 return rows;
}
export const importFields=["name","email","phone","country"] as const;
export type ImportRecord=Record<typeof importFields[number],string>;
export function contactIssues(record:ImportRecord):string[] {
 const issues:string[]=[];
 if(!record.name||record.name.length>160)issues.push("Name is required (maximum 160 characters)");
 if(record.email&&(record.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)))issues.push("Invalid email");
 if(record.phone.length>60)issues.push("Phone is too long");if(record.country.length>100)issues.push("Country is too long");
 return issues;
}
