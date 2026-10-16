'use strict';
// Page contour detection and four-point perspective rectification.
window.ScanCorrection = (() => {
 const ready=()=>!!(window.cv && typeof cv.imread==='function' && typeof cv.Mat==='function');
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function corners(p){
  const sums=p.map(q=>q.x+q.y), diffs=p.map(q=>q.y-q.x);
  const tl=p[sums.indexOf(Math.min(...sums))],br=p[sums.indexOf(Math.max(...sums))];
  const tr=p[diffs.indexOf(Math.min(...diffs))],bl=p[diffs.indexOf(Math.max(...diffs))];
  if(new Set([tl,tr,br,bl]).size!==4)return null;
  return [tl,tr,br,bl];
 }
 function detect(canvas){
  if(!ready())return {points:null,reason:'OpenCV読み込み待ち'};
  let src,gray,blur,edges,contours,hierarchy,kernel;
  try{
   src=cv.imread(canvas);gray=new cv.Mat();blur=new cv.Mat();edges=new cv.Mat();contours=new cv.MatVector();hierarchy=new cv.Mat();
   cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
   cv.Canny(blur,edges,35,110);
   kernel=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(5,5));cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);
   cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
   const areaTotal=canvas.width*canvas.height;let best=null,bestScore=0;
   for(let i=0;i<contours.size();i++){
    const contour=contours.get(i);let approx;
    try{
     const perimeter=cv.arcLength(contour,true);if(perimeter<200)continue;
     approx=new cv.Mat();cv.approxPolyDP(contour,approx,0.025*perimeter,true);
     const area=Math.abs(cv.contourArea(approx));
     if(approx.rows!==4||!cv.isContourConvex(approx)||area<areaTotal*.12||area>areaTotal*.985)continue;
     const d=approx.data32S,p=[];for(let j=0;j<4;j++)p.push({x:d[j*2],y:d[j*2+1]});
     const ordered=corners(p);if(!ordered)continue;
     const w=Math.max(dist(ordered[0],ordered[1]),dist(ordered[3],ordered[2]));
     const h=Math.max(dist(ordered[0],ordered[3]),dist(ordered[1],ordered[2]));
     if(Math.min(w,h)<90||Math.min(w,h)/Math.max(w,h)<.28)continue;
     const score=area/areaTotal;
     if(score>bestScore){best=ordered;bestScore=score;}
    }finally{approx?.delete();contour.delete();}
   }
   return {points:best,reason:best?'':'ページの四隅を検出できませんでした'};
  }catch(e){console.warn('detect',e);return {points:null,reason:'輪郭検出エラー: '+e.message};}
  finally{src?.delete();gray?.delete();blur?.delete();edges?.delete();contours?.delete();hierarchy?.delete();kernel?.delete();}
 }
 function perspective(canvas){
  const result=detect(canvas);if(!result.points)return {canvas,corrected:false,reason:result.reason};
  const p=result.points;let src,from,to,matrix,dst;
  try{
   const width=Math.round(Math.max(dist(p[0],p[1]),dist(p[3],p[2])));
   const height=Math.round(Math.max(dist(p[0],p[3]),dist(p[1],p[2])));
   const scale=Math.min(1,2600/Math.max(width,height));const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
   src=cv.imread(canvas);from=cv.matFromArray(4,1,cv.CV_32FC2,p.flatMap(q=>[q.x,q.y]));
   to=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w-1,0,w-1,h-1,0,h-1]);
   matrix=cv.getPerspectiveTransform(from,to);dst=new cv.Mat();
   cv.warpPerspective(src,dst,matrix,new cv.Size(w,h),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(255,255,255,255));
   const output=document.createElement('canvas');output.width=w;output.height=h;cv.imshow(output,dst);
   return {canvas:output,corrected:true,reason:'四隅を検出して台形補正しました'};
  }catch(e){console.warn('perspective',e);return {canvas,corrected:false,reason:'台形補正エラー: '+e.message};}
  finally{src?.delete();from?.delete();to?.delete();matrix?.delete();dst?.delete();}
 }
 function enhance(canvas){
  const c=canvas.getContext('2d',{willReadFrequently:true}),img=c.getImageData(0,0,canvas.width,canvas.height),d=img.data;
  const hist=new Uint32Array(256);let n=0;const step=Math.max(1,Math.ceil(d.length/4/350000));
  for(let i=0;i<d.length;i+=4*step){hist[Math.round(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])]++;n++;}
  let low=0,high=255,sum=0;for(let i=0;i<256;i++){sum+=hist[i];if(sum>=n*.015){low=i;break;}}
  sum=0;for(let i=255;i>=0;i--){sum+=hist[i];if(sum>=n*.015){high=i;break;}}
  const gain=Math.min(1.35,255/Math.max(90,high-low));
  for(let i=0;i<d.length;i+=4)for(let k=0;k<3;k++)d[i+k]=Math.max(0,Math.min(255,Math.round((d[i+k]-low)*gain+4)));
  c.putImageData(img,0,0);return canvas;
 }
 return {ready,detect,perspective,enhance};
})();
