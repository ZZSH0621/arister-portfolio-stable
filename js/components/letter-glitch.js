// React Bits LetterGlitch adapted for this vanilla JavaScript site.
(function(){
  'use strict';

  const DEFAULTS={
    glitchColors:['#ff6901','#010101','#010101'],
    glitchSpeed:50,
    smooth:true,
    characters:'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789'
  };

  const LetterGlitch={
    _root:null,_canvas:null,_ctx:null,_letters:[],_grid:{columns:0,rows:0},
    _raf:null,_lastGlitch:0,_lastFrame:0,_resizeHandler:null,

    init(options){
      this._root=document.getElementById('letterGlitch');
      if(!this._root)return;
      this._canvas=this._root.querySelector('canvas');
      if(!this._canvas)return;
      this._ctx=this._canvas.getContext('2d');
      if(!this._ctx)return;

      this._options=Object.assign({},DEFAULTS,options||{});
      this._characters=Array.from(this._options.characters);
      this._palette=this._options.glitchColors.map(this._hexToRgb).filter(Boolean);
      this._resizeHandler=App.Utils.debounce(()=>this._resize(),100);
      window.addEventListener('resize',this._resizeHandler);
      document.addEventListener('visibilitychange',()=>{
        if(!document.hidden&&!this._raf)this._animate(performance.now());
      });

      this._resize();
      this._lastGlitch=performance.now();
      this._animate(this._lastGlitch);
    },

    _hexToRgb(hex){
      const value=hex.replace('#','');
      const full=value.length===3?value.split('').map(c=>c+c).join(''):value;
      if(!/^[0-9a-f]{6}$/i.test(full))return null;
      return {r:parseInt(full.slice(0,2),16),g:parseInt(full.slice(2,4),16),b:parseInt(full.slice(4,6),16)};
    },

    _randomChar(){return this._characters[Math.floor(Math.random()*this._characters.length)]},
    _randomColor(){
      const color=this._palette[Math.floor(Math.random()*this._palette.length)]||{r:97,g:220,b:163};
      return {r:color.r,g:color.g,b:color.b};
    },

    _resize(){
      const rect=this._root.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      const dpr=Math.min(window.devicePixelRatio||1,3);
      this._canvas.width=Math.round(rect.width*dpr);
      this._canvas.height=Math.round(rect.height*dpr);
      this._canvas.style.width=rect.width+'px';
      this._canvas.style.height=rect.height+'px';
      this._ctx.setTransform(dpr,0,0,dpr,0,0);
      this._ctx.imageSmoothingEnabled=false;

      const columns=Math.ceil(rect.width/10);
      const rows=Math.ceil(rect.height/20);
      this._grid={columns,rows};
      this._letters=Array.from({length:columns*rows},()=>{
        const color=this._randomColor();
        return {char:this._randomChar(),color,target:this._randomColor(),progress:1};
      });
      this._draw();
    },

    _update(){
      const count=Math.max(1,Math.floor(this._letters.length*0.05));
      for(let i=0;i<count;i++){
        const letter=this._letters[Math.floor(Math.random()*this._letters.length)];
        if(!letter)continue;
        letter.char=this._randomChar();
        letter.target=this._randomColor();
        letter.progress=this._options.smooth?0:1;
        if(!this._options.smooth)letter.color={...letter.target};
      }
    },

    _stepColors(){
      if(!this._options.smooth)return;
      for(const letter of this._letters){
        if(letter.progress>=1)continue;
        const step=Math.min(1,letter.progress+0.08);
        const amount=(step-letter.progress)/Math.max(1-letter.progress,0.001);
        letter.color.r+= (letter.target.r-letter.color.r)*amount;
        letter.color.g+= (letter.target.g-letter.color.g)*amount;
        letter.color.b+= (letter.target.b-letter.color.b)*amount;
        letter.progress=step;
      }
    },

    _draw(){
      const rect=this._canvas.getBoundingClientRect();
      this._ctx.clearRect(0,0,rect.width,rect.height);
      this._ctx.font='16px ui-monospace, SFMono-Regular, Consolas, monospace';
      this._ctx.textBaseline='top';
      this._ctx.imageSmoothingEnabled=false;
      for(let i=0;i<this._letters.length;i++){
        const letter=this._letters[i];
        const x=(i%this._grid.columns)*10;
        const y=Math.floor(i/this._grid.columns)*20;
        const c=letter.color;
        this._ctx.fillStyle=`rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
        this._ctx.fillText(letter.char,x,y);
      }
    },

    _animate(now){
      if(document.hidden){this._raf=null;return}
      if(now-this._lastGlitch>=this._options.glitchSpeed){
        this._update();
        this._lastGlitch=now;
      }
      if(now-this._lastFrame>=33){
        this._stepColors();
        this._draw();
        this._lastFrame=now;
      }
      this._raf=requestAnimationFrame(t=>this._animate(t));
    }
  };

  window.App=window.App||{};
  window.App.LetterGlitch=LetterGlitch;
})();
