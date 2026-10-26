// Avoid embedding entire source files in public assertion-failure annotations.
const escape=value=>String(value).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
export default async function* failures(events){
 for await(const event of events){
  if(event.type!=='test:fail')continue;
  const {name,file,line,column,details}=event.data;
  const error=details?.error?.cause||details?.error;
  const message=String(error?.message||details?.error?.message||'Test failed').slice(0,1500);
  yield '::error title='+escape(name)+ '::'+escape([file+':'+line+':'+column,error?.code||'',message].filter(Boolean).join('\n'))+'\n';
 }
}
