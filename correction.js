'use strict';
// Optional OpenCV.js perspective correction. If the library is unavailable,
// the app still saves a contrast-corrected scan without geometric correction.
const ScanCorrection = (() => {
  const ready = () => !!(window.cv && typeof window.cv.Mat === 'function' && typeof window.cv.imread === 'function');
  function sortCorners(points) {
    const sums=points.map(p=>p.x+p.y), diffs=points.map(p=>p.y-p.x);
    return [points[sums.indexOf(Math.min(...sums))],points[diffs.indexOf(Math.min(...diffs))],points[sums.indexOf(Math.max(...sums))],points[diffs.indexOf(Math.max(...diffs))]];
  }
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function perspective(canvas) {
    if(!ready())return {canvas,corrected:false,reason:'OpenCV未読込'};
    const cv=window.cv;let src,gray,blur,edges,contours,hierarchy,best=null;
    try {
      src=cv.imread(canvas);gray=new cv.Mat();blur=new cv.Mat();edges=new cv.Mat();contours=new cv.MatVector();hierarchy=new cv.Mat();
      cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
      cv.Canny(blur,edges,55,155);cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
      let bestArea=0;const total=canvas.width*canvas.height;
      for(let i=0;i<contours.size();i++){
        const contour=contours.get(i),perimeter=cv.arcLength(contour,true),approx=new cv.Mat();
        try {
          cv.approxPolyDP(contour,approx,.025*perimeter,true);
          const area=Math.abs(cv.contourArea(approx));
          if(approx.rows!==4 || !cv.isContourConvex(approx) || area<total*.12 || area>total*.985 || area<=bestArea)continue;
          const a=approx.data32S;const pts=[];for(let j=0;j<4;j++)pts.push({x:a[j*2],y:a[j*2+1]});
          const sorted=sortCorners(pts);
          const w=Math.max(distance(sorted[0],sorted[1]),distance(sorted[3],sorted[2]));
          const h=Math.max(distance(sorted[0],sorted[3]),distance(sorted[1],sorted[2]));
          if(w<100||h<100||Math.min(w,h)/Math.max(w,h)<.25)continue;
          bestArea=area;best=sorted;
        } finally {approx.delete();contour.delete();}
      }
      if(!best)return {canvas,corrected:false,reason:'四隅を検出できませんでした'};
      const width=Math.max(1,Math.round(Math.max(distance(best[0],best[1]),distance(best[3],best[2]))));
      const height=Math.max(1,Math.round(Math.max(distance(best[0],best[3]),distance(best[1],best[2]))));
      const max=2400,scale=Math.min(1,max/Math.max(width,height));const outW=Math.max(1,Math.round(width*scale)),outH=Math.max(1,Math.round(height*scale));
      const from=cv.matFromArray(4,1,cv.CV_32FC2,best.flatMap(p=>[p.x,p.y]));
      const to=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,outW-1,0,outW-1,outH-1,0,outH-1]);
      let matrix,dst;
      try {matrix=cv.getPerspectiveTransform(from,to);dst=new cv.Mat();cv.warpPerspective(src,dst,matrix,new cv.Size(outW,outH),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(255,255,255,255));const output=document.createElement('canvas');output.width=outW;output.height=outH;cv.imshow(output,dst);return {canvas:output,corrected:true};}
      finally {from.delete();to.delete();matrix?.delete();dst?.delete();}
    }catch(e){console.warn('Perspective correction:',e);return {canvas,corrected:false,reason:'補正エラー'};}
    finally {src?.delete();gray?.delete();blur?.delete();edges?.delete();contours?.delete();hierarchy?.delete();}
  }
  function enhance(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,canvas.width,canvas.height),d=image.data;
    const hist=new Uint32Array(256);let n=0;
    for(let i=0;i<d.length;i+=Math.max(4,4*Math.ceil(d.length/400000))){const y=Math.round(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2]);hist[y]++;n++;}
    let low=0,high=255,sum=0;for(let i=0;i<256;i++){sum+=hist[i];if(sum>=n*.015){low=i;break;}}
    sum=0;for(let i=255;i>=0;i--){sum+=hist[i];if(sum>=n*.015){high=i;break;}}
    const range=Math.max(90,high-low),gain=Math.min(1.35,255/range);
    for(let i=0;i<d.length;i+=4){for(let k=0;k<3;k++){const value=(d[i+k]-low)*gain+4;d[i+k]=Math.max(0,Math.min(255,Math.round(value)));}}
    ctx.putImageData(image,0,0);return canvas;
  }
  return {perspective,enhance,ready};
})();
