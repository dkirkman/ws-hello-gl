'use strict';

import {mat4} from 'gl-matrix';
import dat from 'dat.gui';


function hello_world(controlDiv, canvas, meshSize, lighting, useTexture) {
  let gl = initWebGL(canvas);
  if (!gl) return;

  const programInfo 
          = initProgramInfo(gl, vertexShaderSource, fragmentShaderSource);
  let params = initParams(gl, programInfo, meshSize, lighting, useTexture);
  initGUI(gl, controlDiv, params);

  loadTexture(gl, 'land_ocean_ice_cloud_2048.jpg', 
              texture => helloWorldAnimationLoop(gl, params, texture));
}

function helloWorldAnimationLoop(gl, params, texture) {
  let time_start = window.performance.now();

  // First time through, set parameters for gl.clear
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  
  gl.clearDepth(1.0);                 
  gl.enable(gl.DEPTH_TEST);           
  gl.depthFunc(gl.LEQUAL);            

  function render(time_now) {
    const delta_time = time_now - time_start;
    let obj = params.obj;
        
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    drawObject(gl, params, 0, 0, -params.distance, 
               params.phi, delta_time*0.001*0.5);
    if (params.multipleEarth) {
      drawObject(gl, params, -1.5, 1.5, -params.distance, 
                 params.phi, delta_time*0.001*0.5);

      drawObject(gl, params, 1.5, 1.5, -params.distance, 
                 params.phi, delta_time*0.001*0.5);

      drawObject(gl, params, -1.5, -1.5, -params.distance, 
                 params.phi, delta_time*0.001*0.5);

      drawObject(gl, params, 1.5, -1.5, -params.distance, 
                 params.phi, delta_time*0.001*0.5);

    }
        
    window.requestAnimationFrame(render);    
  };

  // Kick it off the first time
  window.requestAnimationFrame(render);
}


function initWebGL(canvas) {
  let gl = canvas.getContext("webgl");

  if (!gl) {
    console.log("can't find any webgl -- this is not going to work");
    alert("Your browser does not support WebGL");
  }

  return gl;
}


function initProgramInfo(gl, vertexSource, fragmentSource) {
  const shaderProgram = initShaderProgram(gl, vertexSource, fragmentSource);
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram,
                                           'aVertexPosition'),
      vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
      textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
      vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor')
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram,
                                              'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram,
                                             'uModelViewMatrix'),
      normalMatrix: gl.getUniformLocation(shaderProgram,
                                          'uNormalMatrix'),
      directionalLighting: gl.getUniformLocation(shaderProgram,
                                                 'uDirectionalLighting'),
      useTexture: gl.getUniformLocation(shaderProgram,
                                        'uUseTexture')      
    }
  };

  return programInfo;
}

function initParams(gl, programInfo, meshSize, lighting, useTexture) {
  let params = {useTexture: useTexture,
                multipleEarth: false,
                lighting: lighting,
                meshSize: meshSize,
                distance: 6,
                phi: 0,
                obj: make_sphere(gl, meshSize),
                programInfo: programInfo
               };

  return params;
}

function initGUI(gl, controlDiv, params) {
  let gui = new dat.GUI();
  gui.add(params, 'multipleEarth');
  gui.add(params, 'useTexture');
  gui.add(params, 'lighting', ['uniform', 'directional']);
  gui.add(params, 'meshSize', 5, 75).onChange(val => {
    params.meshSize = Math.round(val);
    delete_obj(gl, params.obj);
    params.obj = make_sphere(gl, params.meshSize);
  });
  gui.add(params, 'distance', 2, 30);
  gui.add(params, 'phi', -90, 90);
  
  gui.close();  // Start closed

  controlDiv.appendChild(gui.domElement);
}

/////////////////////////////////////////////////////////////////////////////
// Shaders
/////////////////////////////////////////////////////////////////////////////

const vertexShaderSource = `
    attribute vec3 aVertexNormal;
    attribute vec3 aVertexPosition;
    attribute vec2 aTextureCoord;
    attribute vec4 aVertexColor;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;

    uniform float uDirectionalLighting;

    varying highp vec3 vLighting;
    varying highp vec2 vTextureCoord;
    varying highp vec4 vColor;

    void main() {
      gl_Position =   uProjectionMatrix * uModelViewMatrix 
                    * vec4(aVertexPosition, 1);

      if (uDirectionalLighting > 0.0) {
         highp vec3 ambientLight = vec3(0.1, 0.1, 0.1);
         highp vec3 directionalLightColor = vec3(1, 1, 1);
         highp vec3 directionalVector = normalize(vec3(1.0, 0.3, 0.5));

         highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);

         highp float directional = max(dot(transformedNormal.xyz, 
                                           directionalVector), 0.0);

         vLighting = ambientLight + (directionalLightColor * directional);
      } else {
         vLighting = vec3(1.0, 1.0, 1.0);
      }

      vTextureCoord = aTextureCoord;
      vColor = aVertexColor;
    }
  `;

const fragmentShaderSource = `
    varying highp vec3 vLighting;
    varying highp vec2 vTextureCoord;
    varying highp vec4 vColor;

    uniform sampler2D uSampler;
    uniform lowp float uUseTexture;

    void main() {
      highp vec4 color;
      if (uUseTexture > 0.0) {
         color = texture2D(uSampler, vTextureCoord);
      } else {
         color = vColor;
      }

      gl_FragColor = vec4(color.rgb * vLighting, color.a);
    }
  `;


function bindVertexAttrib(gl, size, buffer, aloc) {
  const type = gl.FLOAT;
  const normalize = false;
  const stride = 0;
  const offset = 0;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(aloc, size, type, normalize, stride, offset);
    gl.enableVertexAttribArray(aloc);  
}

function bindAttribs(gl, params, obj) {
  const programInfo = params.programInfo;
  const alocs = programInfo.attribLocations;
  bindVertexAttrib(gl, 3, obj.vertexBuffer, 
                      alocs.vertexPosition);

  bindVertexAttrib(gl, 3, obj.normalBuffer, 
                      alocs.vertexNormal);

  bindVertexAttrib(gl, 4, obj.colorBuffer, 
                      alocs.vertexColor);

  bindVertexAttrib(gl, 2, obj.textureBuffer, 
                      alocs.textureCoord);
    
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer);
}

function bindUniforms(gl, params, obj, modelViewMatrix) {
  const programInfo = params.programInfo;

  const fieldOfView = 25 * Math.PI / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();
  
  mat4.perspective(projectionMatrix,
                   fieldOfView,
                   aspect,
                   zNear,
                   zFar);
  
  
  const normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelViewMatrix);
  mat4.transpose(normalMatrix, normalMatrix);
  

  const ulocs = programInfo.uniformLocations;
  gl.uniformMatrix4fv(ulocs.projectionMatrix,
                      false,
                      projectionMatrix);
  gl.uniformMatrix4fv(ulocs.modelViewMatrix,
                      false,
                      modelViewMatrix);
  gl.uniformMatrix4fv(ulocs.normalMatrix,
                      false,
                      normalMatrix);
  
  if (params.useTexture) {
    gl.uniform1f(ulocs.useTexture, 1.0);
  } else {
    gl.uniform1f(ulocs.useTexture, 0.0);
  }
  
  if (params.lighting === "directional") {
      gl.uniform1f(ulocs.directionalLighting, 1.0);
  } else {
    gl.uniform1f(ulocs.directionalLighting, 0.0);
  }

}

function bindAndRender(gl, params, obj, modelViewMatrix) {
  gl.useProgram(params.programInfo.program);
  bindAttribs(gl, params, obj);
  bindUniforms(gl, params, obj, modelViewMatrix);
  
  {
    const offset = 0;
    const type = gl.UNSIGNED_SHORT;
    gl.drawElements(gl.TRIANGLES, obj.vertexCount, type, offset);        
  }
}


function make_sphere(gl, meshSize) {
  var positions = [];
  var colors = [];
  var normals = [];
  var indices = [];
  var textureCoords = [];
  
  let nlong = meshSize; 
  let nlat = meshSize;  
  
  var count = 0;
  for (var j=0; j<=nlat; ++j) {
    for (var i=0; i<=nlong; ++i) {
      var long = (2*Math.PI/nlong) * i;
      var lat = (Math.PI/nlat) * j;
      
      var index = j*(nlong+1) + i;

      positions[index*6 + 0] = Math.cos(long)*Math.sin(lat);
      positions[index*6 + 1] = Math.sin(long)*Math.sin(lat);
      positions[index*6 + 2] = Math.cos(lat);

      positions[index*6 + 3] = Math.cos(long)*Math.sin(lat);
      positions[index*6 + 4] = Math.sin(long)*Math.sin(lat);
      positions[index*6 + 5] = Math.cos(lat);



      normals[index*6 + 0] = Math.cos(long)*Math.sin(lat);
      normals[index*6 + 1] = Math.sin(long)*Math.sin(lat);
      normals[index*6 + 2] = Math.cos(lat);

      normals[index*6 + 3] = Math.cos(long)*Math.sin(lat);
      normals[index*6 + 4] = Math.sin(long)*Math.sin(lat);
      normals[index*6 + 5] = Math.cos(lat);
      

      textureCoords[index*4 + 0] = i/nlong;
      textureCoords[index*4 + 1] = j/nlat;

      textureCoords[index*4 + 2] = i/nlong;
      textureCoords[index*4 + 3] = j/nlat;
      

      colors[index*8 + 0] = 0.0;
      colors[index*8 + 1] = 1.0;
      colors[index*8 + 2] = 0.0;
      colors[index*8 + 3] = 1.0;
      
      colors[index*8 + 4] = 0.0;
      colors[index*8 + 5] = 0.0;
      colors[index*8 + 6] = 1.0;
      colors[index*8 + 7] = 1.0;

      if (i < nlong && j < nlat) {
        var iindex = j*(nlong+1) + i;
        var nn = nlong+1;

        if (j > -1 && j < nlat-1 + 2) {
          indices[iindex*6 + 0] = ((j+1)*nn + i)*2;
          indices[iindex*6 + 1] = (j*nn + i)*2;
          indices[iindex*6 + 2] = (j*nn + (i+1))*2;

          indices[iindex*6 + 3] = ((j+1)*nn + i)*2 + 1;          
          indices[iindex*6 + 4] = ((j+1)*nn + (i+1))*2 + 1;
          indices[iindex*6 + 5] = (j*nn + (i+1))*2 + 1;        
        } 
      }
    }
  }
  
  let vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  
  let colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  
  let normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals),
                gl.STATIC_DRAW);
  
  
  let textureBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords),
                gl.STATIC_DRAW);
  
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
                new Uint16Array(indices), gl.STATIC_DRAW);
  
  return {vertexBuffer: vertexBuffer,
          colorBuffer: colorBuffer,
          normalBuffer: normalBuffer,
          indexBuffer: indexBuffer,
          textureBuffer: textureBuffer,
          vertexCount: indices.length};
}

function delete_obj(gl, obj) {
  gl.deleteBuffer(obj.vertexBuffer);
  gl.deleteBuffer(obj.colorBuffer);
  gl.deleteBuffer(obj.normalBuffer);
  gl.deleteBuffer(obj.indexBuffer);
  gl.deleteBuffer(obj.textureBuffer);
}

function drawObject(gl, params, offset_x, offset_y, offset_z, phi, theta) {
  const modelViewMatrix = mat4.create();

  mat4.translate(modelViewMatrix,     // destination matrix
                 modelViewMatrix,     // matrix to translate
                 [offset_x, offset_y, offset_z]);  // Amount to translate
  
  mat4.rotate(modelViewMatrix,
              modelViewMatrix,
              -Math.PI/2.0 + phi*Math.PI/180.0,
              [1, 0, 0]);
  
  mat4.rotate(modelViewMatrix,
              modelViewMatrix,
              theta,
              [0, 0, 1]);

  let obj = params.obj;
  bindAndRender(gl, params, obj, modelViewMatrix);
}

/////////////////////////////////////////////////////////////////////////////
// Utility functions from https://github.com/mdn/webgl-examples (slightly modified)
// Original code under CC0 license
/////////////////////////////////////////////////////////////////////////////

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  } 
  
  return shader;
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  } 
  
  return shaderProgram;
}

//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url, continuation) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  // Because images have to be download over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType,
                pixel);

  const image = new Image();
  image.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, image);

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
       // Yes, it's a power of 2. Generate mips.
       gl.generateMipmap(gl.TEXTURE_2D);
    } else {
       // No, it's not a power of 2. Turn of mips and set
       // wrapping to clamp to edge
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    continuation(texture);
  };
  image.src = url;
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

/////////////////////////////////////////////////////////////////////////////
// End utility functions
/////////////////////////////////////////////////////////////////////////////

export default hello_world;



