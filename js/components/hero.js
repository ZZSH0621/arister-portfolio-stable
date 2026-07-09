// js/components/hero.js
// WebGL CRT-TV effect: photo displayed on a vintage television screen
(function(){
  'use strict';
  const Hero={
    _canvas:null,_scene:null,_renderer:null,_cleanup:null,_pull:null,_video:null,

    init(){
      this._canvas=document.getElementById('heroCanvas');
      if(this._canvas)this._setupWebGL();
      this._setupPullCord();
    },

    _setupPullCord(){
      const hero=document.getElementById('hero');
      const pull=document.getElementById('heroPull');
      const video=document.getElementById('heroVideo');
      const stage=document.getElementById('heroVideoStage');
      const soundToggle=document.getElementById('heroSoundToggle');
      if(!hero||!pull||!video||!stage)return;

      this._pull=pull;
      this._video=video;
      const heroRef=this;

      // Preload full video via Fetch -> Blob URL (eliminates buffering lag)
      const videoUrl=(video.querySelector('source')||video).getAttribute('src');
      if(videoUrl&&!videoUrl.startsWith('blob:')){
        const hint=pull.querySelector('.hero__pull-hint');
        if(hint)hint.textContent='预加载中…';
        fetch(videoUrl).then(function(r){
          if(!r.ok)throw new Error('Fetch failed');
          return r.blob();
        }).then(function(blob){
          const blobUrl=URL.createObjectURL(blob);
          var sourceEl=video.querySelector('source');
          if(sourceEl)sourceEl.remove();
          video.src=blobUrl;
          if(hint)hint.textContent='下拉切换视频';
        }).catch(function(){
          if(hint)hint.textContent='下拉切换视频';
        });
      }

      const setVideoAudible=(audible)=>{
        video.muted=!audible;
        video.defaultMuted=!audible;
        if(audible){
          video.removeAttribute('muted');
          video.volume=1;
        }else{
          video.setAttribute('muted','');
        }
      };
      const playWithSound=()=>{
        setVideoAudible(true);
        syncSoundToggle();
        const playback=video.play();
        if(playback&&typeof playback.catch==='function'){
          playback.catch(()=>{
            setVideoAudible(true);
            syncSoundToggle();
          });
        }
      };
      setVideoAudible(true);
      video.setAttribute('playsinline','');
      video.setAttribute('webkit-playsinline','');
      window.setTimeout(()=>{
        if(!hero.classList.contains('is-video-active')){
          video.preload='auto';
        }
      },2000);
      const threshold=68;
      const maxPull=96;
      let startY=0;
      let distance=0;
      let dragging=false;

      const syncSoundToggle=()=>{
        if(!soundToggle)return;
        const isOn=!video.muted;
        soundToggle.classList.toggle('is-on',isOn);
        soundToggle.setAttribute('aria-pressed',String(isOn));
        soundToggle.setAttribute('aria-label',isOn?'关闭视频声音':'开启视频声音');
        soundToggle.textContent=isOn?'关闭声音':'开启声音';
      };

      const setDistance=(value)=>{
        distance=Math.max(0,Math.min(maxPull,value));
        pull.style.setProperty('--pull-distance',distance+'px');
      };
      const toggleLayer=()=>{
        const showVideo=!hero.classList.contains('is-video-active');
        hero.classList.toggle('is-video-active',showVideo);
        stage.setAttribute('aria-hidden',String(!showVideo));
        pull.setAttribute('aria-label',showVideo?'向下拉动绳子返回首页':'向下拉动绳子切换到视频');

        if(!showVideo){
          video.pause();
          setVideoAudible(true);
          syncSoundToggle();
          // Resume WebGL render loop
          if(!heroRef._cleanup&&heroRef._renderFrame) heroRef._cleanup=App.Utils.raf(heroRef._renderFrame);
          return;
        }

        // Pause WebGL render loop — free GPU for video decoding
        if(heroRef._cleanup){heroRef._cleanup();heroRef._cleanup=null;}

        setVideoAudible(true);
        video.setAttribute('playsinline','');
        video.setAttribute('webkit-playsinline','');
        if(video.readyState >= 3){
          try{video.currentTime=0;}catch(_){}
          playWithSound();
        }else{
          video.addEventListener('canplay',function readyHandler(){
            video.removeEventListener('canplay',readyHandler);
            try{video.currentTime=0;}catch(_){}
            playWithSound();
          },{once:true});
        }
      };
      const finish=(pointerId)=>{
        if(!dragging)return;
        dragging=false;
        pull.classList.remove('is-dragging');
        if(pointerId!==undefined&&pull.hasPointerCapture(pointerId))pull.releasePointerCapture(pointerId);
        if(distance>=threshold)toggleLayer();
        setDistance(0);
      };

      pull.addEventListener('pointerdown',(event)=>{
        if(event.button!==0&&event.pointerType==='mouse')return;
        setVideoAudible(true);
        syncSoundToggle();
        dragging=true;
        startY=event.clientY;
        pull.classList.add('is-dragging');
        pull.setPointerCapture(event.pointerId);
      });
      pull.addEventListener('pointermove',(event)=>{
        if(!dragging)return;
        setDistance(event.clientY-startY);
      });
      pull.addEventListener('pointerup',(event)=>finish(event.pointerId));
      pull.addEventListener('pointercancel',(event)=>finish(event.pointerId));
      pull.addEventListener('keydown',(event)=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleLayer();}
      });
      if(soundToggle){
        soundToggle.addEventListener('click',()=>{
          const shouldUnmute=video.muted;
          setVideoAudible(shouldUnmute);
          syncSoundToggle();
          if(shouldUnmute){
            playWithSound();
          }
        });
        syncSoundToggle();
      }

      const visibilityObserver=new IntersectionObserver((entries)=>{
        const isVisible=entries[0]&&entries[0].isIntersecting;
        pull.classList.toggle('is-hidden',!isVisible);
        if(!isVisible){
          dragging=false;
          pull.classList.remove('is-dragging');
          setVideoAudible(true);
          syncSoundToggle();
          setDistance(0);
        }
      },{threshold:0});
      visibilityObserver.observe(hero);
    },

    _setupWebGL(){
      if(typeof THREE==='undefined')return;
      const self=this;
      const rect=this._canvas.parentElement.getBoundingClientRect();
      this._renderer=new THREE.WebGLRenderer({canvas:this._canvas,alpha:true,antialias:true});
      this._renderer.setSize(rect.width,rect.height,false);
      this._renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));

      this._scene=new THREE.Scene();
      const camera=new THREE.PerspectiveCamera(45,rect.width/Math.max(rect.height,1),0.1,10);
      camera.position.z=2.5;

      // Load photo texture
      const loader=new THREE.TextureLoader();
      const photoTex=loader.load(window.__HERO_PHOTO||'hero-photo.png',()=>{
        this._canvas.classList.add('is-ready');
      });

      const geo=new THREE.PlaneGeometry(2.2,2.2);
      const mat=new THREE.ShaderMaterial({
        uniforms:{
          uTime:{value:0},
          uResolution:{value:new THREE.Vector2(rect.width,rect.height)},
          uColor1:{value:new THREE.Color('#ff5e2c')},
          uColor2:{value:new THREE.Color('#1a1a2e')},
          uPhoto:{value:photoTex}
        },
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader:`varying vec2 vUv;uniform float uTime;uniform vec3 uColor1,uColor2;uniform sampler2D uPhoto;
        float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          vec2 uv=vUv;

          // CRT barrel distortion (screen curvature)
          vec2 centered=uv-0.5;
          float r2=dot(centered,centered);
          float barrel=1.0+r2*0.08;
          vec2 uvCRT=0.5+centered*barrel;

          // Clamp to screen bounds
          if(uvCRT.x<0.0||uvCRT.x>1.0||uvCRT.y<0.0||uvCRT.y>1.0){
            gl_FragColor=vec4(0.0,0.0,0.0,1.0);
            return;
          }

          // Signal jitter — horizontal wobble (slowed)
          float jitter=noise(vec2(uv.y*25.0,uTime*0.25))*0.012;
          jitter+=noise(vec2(uv.y*8.0,uTime*0.4))*0.006;
          uvCRT.x+=jitter;

          // Vertical jitter — V-hold glitch (slowed)
          float vJitter=noise(vec2(uTime*0.3,0.0))*0.006;
          uvCRT.y+=vJitter;

          // Random horizontal glitch bands (slowed)
          float glitchBand=step(0.92,noise(vec2(uv.y*2.0,uTime*0.5)));
          float glitchShift=glitchBand*noise(vec2(uv.y,uTime*0.6))*0.04;
          uvCRT.x+=glitchShift;

          // Sample photo
          vec4 photo=texture2D(uPhoto,uvCRT);

          // Stronger chromatic aberration at edges
          float edge=abs(centered.x)*2.0;
          float caShift=edge*0.012;
          float r=texture2D(uPhoto,uvCRT+vec2(caShift,0.0)).r;
          float b=texture2D(uPhoto,uvCRT-vec2(caShift,0.0)).b;
          photo.r=mix(photo.r,r,edge*0.5);
          photo.b=mix(photo.b,b,edge*0.5);

          // Phosphor glow: bright areas bleed
          float brightness=dot(photo.rgb,vec3(0.299,0.587,0.114));
          float glow=smoothstep(0.6,1.0,brightness)*0.08;
          photo.rgb+=glow;

          // CRT scanlines
          float scanY=uvCRT.y*600.0;
          float scanline=1.0-smoothstep(0.3,0.7,sin(scanY*3.14159)*0.5+0.5)*0.10;

          // Phosphor mask
          float maskP=1.0-smoothstep(0.4,0.6,sin(scanY*3.14159)*0.5+0.5)*0.04;

          // Film grain (slowed)
          float grain=noise(uv*250.0+uTime*0.4)*0.12-0.06;
          grain+=noise(uv*80.0-uTime*0.2)*0.06-0.03;

          // Screen reflection sheen
          float sheen=(1.0-abs(centered.y))*0.08;
          sheen*=smoothstep(0.2,0.0,abs(centered.x-0.15));

          // Vignette
          float dist=length(centered)*1.3;
          float vignette=smoothstep(0.35,0.9,dist);

          // Assemble
          vec3 col=photo.rgb;
          col*=scanline;
          col*=maskP;
          col+=grain;
          col+=sheen;

          // Edge darkening
          col=mix(col,vec3(0.0),vignette*0.5);

          // Subtle warm color cast
          col*=vec3(1.02,0.98,0.94);

          // Brightness & color flicker (slowed)
          float flicker=noise(vec2(uTime*0.15,0.0))*0.05;
          flicker+=noise(vec2(uTime*0.5,1.0))*0.03;
          col*=1.0+flicker;

          // Occasional color channel glitch (slowed)
          float colorGlitch=step(0.94,noise(vec2(uTime*0.2,0.0)));
          if(colorGlitch>0.5){
            col.r+=noise(vec2(uv.y*10.0,uTime))*0.04;
            col.b-=noise(vec2(uv.y*10.0,uTime+1.0))*0.04;
          }

          // Outer bezel shadow (screen frame)
          float bezel=smoothstep(0.44,0.5,dist);
          col=mix(col,vec3(0.0),bezel*0.6);

          gl_FragColor=vec4(col,1.0);
        }`
      });
      const mesh=new THREE.Mesh(geo,mat);
      this._scene.add(mesh);

      // Resize handler
      const onResize=App.Utils.debounce(()=>{
        const r=this._canvas.parentElement.getBoundingClientRect();
        this._renderer.setSize(r.width,r.height,false);
        mat.uniforms.uResolution.value.set(r.width,r.height);
      },200);
      window.addEventListener('resize',onResize);

      this._renderFrame=(t)=>{
        mat.uniforms.uTime.value=t*0.001;
        this._renderer.render(this._scene,camera);
      };
      this._cleanup=App.Utils.raf(this._renderFrame);
    },

    destroy(){if(this._cleanup)this._cleanup()}
  };
  window.App=window.App||{};window.App.Hero=Hero;
})();
