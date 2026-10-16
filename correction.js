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
  if(!ready())return {points:null,reason:'OpenCV未準備：通信状態を確認して再読み込み'};
  let src,small,gray,blur,edges,contours,hierarchy,kernel;
  try{
   src=cv.imread(canvas);
   // Detect on a downscaled image: faster and more stable on iPhone.
   const scale=Math.min(1,900/Math.max(src.cols,src.rows));
   small=new cv.Mat();cv.resize(src,small,new cv.Size(Math.max(1,Math.round(src.cols*scale)),Math.max(1,Math.round(src.rows*scale))),0,0,cv.INTER_AREA);
   gray=new cv.Mat();blur=new cv.Mat();edges=new cv.Mat();
   cv.cvtColor(small,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
   const areaTotal=small.cols*small.rows;let best=null,bestScore=-Infinity;
   // Multiple Canny thresholds help with low-contrast paper edges.
   for(const [lo,hi] of [[20,65],[45,125],[75,190]]){
    cv.Canny(blur,edges,lo,hi);
    kernel=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(5,5));
    cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);kernel.delete();kernel=null;
    contours=new cv.MatVector();hierarchy=new cv.Mat();
    cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    for(let i=0;i<contours.size();i++){
     const contour=contours.get(i);let approx;
     try{
      const perimeter=cv.arcLength(contour,true);if(perimeter<100)continue;
      for(const epsilon of [.018,.03,.045,.065]){
       approx?.delete();approx=new cv.Mat();cv.approxPolyDP(contour,approx,epsilon*perimeter,true);
       if(approx.rows!==4||!cv.isContourConvex(approx))continue;
       const area=Math.abs(cv.contourArea(approx));if(area<areaTotal*.08||area>areaTotal*.97)continue;
       const d=approx.data32S,p=[];for(let j=0;j<4;j++)p.push({x:d[j*2],y:d[j*2+1]});
       const ordered=corners(p);if(!ordered)continue;
       const w=Math.max(dist(ordered[0],ordered[1]),dist(ordered[3],ordered[2]));
       const h=Math.max(dist(ordered[0],ordered[3]),dist(ordered[1],ordered[2]));
       if(Math.min(w,h)<60||Math.min(w,h)/Math.max(w,h)<.23)continue;
       const margin=Math.min(...ordered.map(q=>Math.min(q.x,q.y,small.cols-q.x,small.rows-q.y)));
       const score=area/areaTotal-(margin<3?.08:0);
       if(score>bestScore){best=ordered.map(q=>({x:q.x/scale,y:q.y/scale}));bestScore=score;}
      }
     }finally{approx?.delete();contour.delete();}
    }
    contours.delete();contours=null;hierarchy.delete();hierarchy=null;
   }
   return {points:best,reason:best?'':'四隅を検出できません。紙全体を映し、背景を暗くしてください'};
  }catch(e){console.warn('detect',e);return {points:null,reason:'輪郭検出エラー: '+e.message};}
  finally{src?.delete();small?.delete();gray?.delete();blur?.delete();edges?.delete();contours?.delete();hierarchy?.delete();kernel?.delete();}
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

// Pure JavaScript perspective transform: works without OpenCV / external CDN.
function solve8(A,b){
 const n=8;A=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;
 if(Math.abs(A[pivot][i])<1e-9)throw Error('四隅の位置が不正です');[A[i],A[pivot]]=[A[pivot],A[i]];
 const v=A[i][i];for(let k=i;k<=n;k++)A[i][k]/=v;
 for(let j=0;j<n;j++)if(j!==i){const q=A[j][i];for(let k=i;k<=n;k++)A[j][k]-=q*A[i][k];}}
 return A.map(r=>r[n]);}
function homography(dst,src){const A=[],b=[];for(let i=0;i<4;i++){
 const {x,y}=dst[i],{x:u,y:v}=src[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);
 A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}
 return solve8(A,b);}
function warpJS(canvas,p){
 const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 let w=Math.round(Math.max(d(p[0],p[1]),d(p[3],p[2]))),h=Math.round(Math.max(d(p[0],p[3]),d(p[1],p[2])));
 const scale=Math.min(1,1800/Math.max(w,h));w=Math.max(2,Math.round(w*scale));h=Math.max(2,Math.round(h*scale));
 if(w<80||h<80)throw Error('四隅を広く指定してください');
 const target=[{x:0,y:0},{x:w-1,y:0},{x:w-1,y:h-1},{x:0,y:h-1}];
 const H=homography(target,p),sw=canvas.width,sh=canvas.height;
 const sctx=canvas.getContext('2d',{willReadFrequently:true}),s=sctx.getImageData(0,0,sw,sh).data;
 const out=document.createElement('canvas');out.width=w;out.height=h;const oc=out.getContext('2d');const im=oc.createImageData(w,h),data=im.data;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const den=H[6]*x+H[7]*y+1,sx=(H[0]*x+H[1]*y+H[2])/den,sy=(H[3]*x+H[4]*y+H[5])/den;
 const o=(y*w+x)*4;if(sx<0||sy<0||sx>=sw-1||sy>=sh-1){data[o]=data[o+1]=data[o+2]=255;data[o+3]=255;continue;}
 const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,a=(iy*sw+ix)*4,b=a+4,c=a+sw*4,e=c+4;
 for(let k=0;k<3;k++)data[o+k]=s[a+k]*(1-fx)*(1-fy)+s[b+k]*fx*(1-fy)+s[c+k]*(1-fx)*fy+s[e+k]*fx*fy;
 data[o+3]=255;
 }
 oc.putImageData(im,0,0);return out;
}

 return {ready,detect,perspective,enhance,warpJS};
})();
