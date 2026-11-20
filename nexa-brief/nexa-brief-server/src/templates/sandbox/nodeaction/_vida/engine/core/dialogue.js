// Keep Whisper times/anchor spelling immutable; align display words separately.
const numbers = ['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciseis','diecisiete','dieciocho','diecinueve','veinte'];
export const normalizeText = text => String(text).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function tokenKey(text) {
  const key=normalizeText(text).replace(/[^\p{L}\p{N}]/gu,'');
  return /^\d+$/.test(key) && numbers[Number(key)] ? numbers[Number(key)] : key;
}
export function alignScript(words,text,path,warnings) {
  if(!text)return words.map(w=>({...w}));
  const tokens=text.trim().split(/\s+/u).filter(Boolean), n=words.length, m=tokens.length;
  // Edit alignment recovers following words after an insertion, deletion or mismatch.
  const dp=Array.from({length:n+1},()=>Array(m+1).fill(0));
  for(let i=0;i<=n;i++)dp[i][0]=i;
  for(let j=0;j<=m;j++)dp[0][j]=j;
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(tokenKey(words[i-1].w)===tokenKey(tokens[j-1])?0:1));
  const aligned=words.map(w=>({...w}));let i=n,j=m;
  while(i||j){
    const match=i&&j&&tokenKey(words[i-1].w)===tokenKey(tokens[j-1]);
    if(i&&j&&dp[i][j]===dp[i-1][j-1]+(match?0:1)){
      if(match)aligned[i-1].w=tokens[j-1];
      else warnings.push({path,code:'subtitle-mismatch',message:`«${tokens[j-1]}» no alinea con «${words[i-1].w}»; se usa Whisper`,word:i-1});
      i--;j--;
    }else if(i&&dp[i][j]===dp[i-1][j]+1){warnings.push({path,code:'subtitle-mismatch',message:`«${words[i-1].w}» sin pareja en el guion; se usa Whisper`,word:i-1});i--;}
    else {warnings.push({path,code:'subtitle-mismatch',message:`«${tokens[j-1]}» sin tiempo Whisper; se omite`});j--;}
  }
  return aligned;
}
export function emotionFace(emotion,table={}) {
  const text=normalizeText(emotion??'');
  const rule=(table.rules??[]).find(r=>r.keywords.some(k=>text.includes(normalizeText(k))));
  const {keywords,...face}=rule??table.default??{expression:'neutral',intensity:.65};
  return structuredClone(face);
}
