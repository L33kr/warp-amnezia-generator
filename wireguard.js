/*! SPDX-License-Identifier: GPL-2.0
 * Based on WireGuard JavaScript key generation code.
 * Copyright (C) 2015-2020 Jason A. Donenfeld <Jason@zx2c4.com>.
 */
(function(){
  'use strict';
  function gf(init){var r=new Float64Array(16);if(init)for(var i=0;i<init.length;++i)r[i]=init[i];return r}
  function pack(o,n){var b,m=gf(),t=gf();for(var i=0;i<16;++i)t[i]=n[i];carry(t);carry(t);carry(t);for(var j=0;j<2;++j){m[0]=t[0]-0xffed;for(i=1;i<15;++i){m[i]=t[i]-0xffff-((m[i-1]>>16)&1);m[i-1]&=0xffff}m[15]=t[15]-0x7fff-((m[14]>>16)&1);b=(m[15]>>16)&1;m[14]&=0xffff;cswap(t,m,1-b)}for(i=0;i<16;++i){o[2*i]=t[i]&0xff;o[2*i+1]=t[i]>>8}}
  function carry(o){for(var i=0;i<16;++i){o[(i+1)%16]+=(i<15?1:38)*Math.floor(o[i]/65536);o[i]&=0xffff}}
  function cswap(p,q,b){var t,c=~(b-1);for(var i=0;i<16;++i){t=c&(p[i]^q[i]);p[i]^=t;q[i]^=t}}
  function add(o,a,b){for(var i=0;i<16;++i)o[i]=(a[i]+b[i])|0}
  function sub(o,a,b){for(var i=0;i<16;++i)o[i]=(a[i]-b[i])|0}
  function mul(o,a,b){var t=new Float64Array(31);for(var i=0;i<16;++i)for(var j=0;j<16;++j)t[i+j]+=a[i]*b[j];for(i=0;i<15;++i)t[i]+=38*t[i+16];for(i=0;i<16;++i)o[i]=t[i];carry(o);carry(o)}
  function inv(o,i){var c=gf();for(var a=0;a<16;++a)c[a]=i[a];for(a=253;a>=0;--a){mul(c,c,c);if(a!==2&&a!==4)mul(c,c,i)}for(a=0;a<16;++a)o[a]=c[a]}
  function clamp(z){z[31]=(z[31]&127)|64;z[0]&=248}
  function publicKey(privateKey){var r,z=new Uint8Array(32),a=gf([1]),b=gf([9]),c=gf(),d=gf([1]),e=gf(),f=gf(),x=gf([0xdb41,1]),nine=gf([9]);for(var i=0;i<32;++i)z[i]=privateKey[i];clamp(z);for(i=254;i>=0;--i){r=(z[i>>>3]>>>(i&7))&1;cswap(a,b,r);cswap(c,d,r);add(e,a,c);sub(a,a,c);add(c,b,d);sub(b,b,d);mul(d,e,e);mul(f,a,a);mul(a,c,a);mul(c,b,e);add(e,a,c);sub(a,a,c);mul(b,a,a);sub(c,d,f);mul(a,c,x);add(a,a,d);mul(c,c,a);mul(a,d,f);mul(d,b,nine);mul(b,e,e);cswap(a,b,r);cswap(c,d,r)}inv(c,c);mul(a,a,c);pack(z,a);return z}
  function privateKey(){var k=new Uint8Array(32);crypto.getRandomValues(k);clamp(k);return k}
  function b64(bytes){var s='';for(var i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s)}
  window.wireguard={generateKeypair:function(){var priv=privateKey();var pub=publicKey(priv);return{privateKey:b64(priv),publicKey:b64(pub)}}};
})();
