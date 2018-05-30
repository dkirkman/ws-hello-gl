'use strict';

import {mat4} from 'gl-matrix';
import dat from 'dat.gui';


/////////////////////////////////////////////////////////////////////////////
// Shaders
/////////////////////////////////////////////////////////////////////////////

// Vertex shader
const vsSource = `
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

// Fragment shader
const fsSource = `
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


// Fragment shader
const fsSourceColored = `
    varying highp vec3 vLighting;
    varying highp vec4 vColor;

    void main() {
      gl_FragColor = vec4(vColor.rgb * vLighting, color.a);
    }
  `;

/////////////////////////////////////////////////////////////////////////////
// Utility Functions
/////////////////////////////////////////////////////////////////////////////

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    } else {
        console.log('shader successfully compiled');
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
    } else {
        console.log('shader program successfully linked');
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

// TODO:  This needs to take a modelViewMatrix instead of deltaTime, but otherwise
//        it's about right.
function drawScene(gl, programInfo, vertexBuffer, colorBuffer, normalBuffer,
                   textureBuffer, indexBuffer, vertexCount, deltaTime, 
                   lighting, use_texture, distance, phi) {
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


    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix,     // destination matrix
                   modelViewMatrix,     // matrix to translate
                   [0.0, 0.0, -distance]);  // Amount to translate


    mat4.rotate(modelViewMatrix,
                modelViewMatrix,
                -Math.PI/2.0 + phi*Math.PI/180.0,
                [1, 0, 0]);


    mat4.rotate(modelViewMatrix,
                modelViewMatrix,
                deltaTime*0.2,
                [0, 0, 1]);

    const normalMatrix = mat4.create();
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    {
        const numComponents = 3;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexPosition);
    }

    {
        const numComponents = 3;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexNormal,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexNormal);
    }

    
    {
        const numComponents = 4;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexColor,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexColor);
    }

    {
        const num = 2; // every coordinate composed of 2 values
        const type = gl.FLOAT; // the data in the buffer is 32 bit float
        const normalize = false; // don't normalize
        const stride = 0; // how many bytes to get from one set to the next
        const offset = 0; // how many butes inside the buffer to start from
        gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 
                               num, type, normalize, stride, offset);
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
    }


    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix,
                        false,
                        projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix,
                        false,
                        modelViewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix,
                        false,
                        normalMatrix);

    if (use_texture) {
      gl.uniform1f(programInfo.uniformLocations.useTexture, 1.0);
    } else {
      gl.uniform1f(programInfo.uniformLocations.useTexture, 0.0);
    }

    if (lighting === "directional") {
      gl.uniform1f(programInfo.uniformLocations.directionalLighting, 1.0);
    } else {
      gl.uniform1f(programInfo.uniformLocations.directionalLighting, 0.0);
    }

    {
      const offset = 0;
      const type = gl.UNSIGNED_INT;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);        
//      gl.drawElements(gl.LINES, vertexCount, type, offset);        
    }
}


function make_sphere(gl, mesh_size) {
  var positions = [];
  var colors = [];
  var normals = [];
  var indices = [];
  var textureCoords = [];
  
  //    positions = positions.concat(0.0, 0.0, 1.0);
  //    colors = colors.concat(1.0, 0.0, 1.0, 1.0);
  //    normals = normals.concat(0.0, 0.0, 1.0);
  
  let nlong = mesh_size;   // Number of longitude subdivisions
  let nlat = mesh_size;    // Number of lattitude subdivisions
  
  var count = 0;
  for (var j=0; j<=nlat; ++j) {
    for (var i=0; i<=nlong; ++i) {
      var long = (2*Math.PI/nlong) * i;
      var lat = (Math.PI/nlat) * j;
      
      var index = j*(nlong+1) + i;

      /*      
       */    
      positions[index*6 + 0] = Math.cos(long)*Math.sin(lat);
      positions[index*6 + 1] = Math.sin(long)*Math.sin(lat);
      positions[index*6 + 2] = Math.cos(lat);

      positions[index*6 + 3] = Math.cos(long)*Math.sin(lat);
      positions[index*6 + 4] = Math.sin(long)*Math.sin(lat);
      positions[index*6 + 5] = Math.cos(lat);

      /*      
       */
      normals[index*6 + 0] = Math.cos(long)*Math.sin(lat);
      normals[index*6 + 1] = Math.sin(long)*Math.sin(lat);
      normals[index*6 + 2] = Math.cos(lat);

      normals[index*6 + 3] = Math.cos(long)*Math.sin(lat);
      normals[index*6 + 4] = Math.sin(long)*Math.sin(lat);
      normals[index*6 + 5] = Math.cos(lat);
      
      /*
      */
      textureCoords[index*4 + 0] = i/nlong;
      textureCoords[index*4 + 1] = j/nlat;

      textureCoords[index*4 + 2] = i/nlong;
      textureCoords[index*4 + 3] = j/nlat;
      
//      console.log(textureCoords[index*4 + 0] + ' ' + textureCoords[index*4+1]);
      /*
       */      
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
                new Uint32Array(indices), gl.STATIC_DRAW);
  
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

function hello_world(control_div, canvas, mesh_size, lighting, use_texture) {
  let gl = canvas.getContext("webgl");
  var uints_for_indices = gl.getExtension("OES_element_index_uint");

  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
  
  
  let params = {texture: use_texture,
                lighting: lighting,
                mesh_size: mesh_size,
                distance: 6,
                phi: 0,
                obj: make_sphere(gl, mesh_size)
               };

  let gui = new dat.GUI();
  gui.add(params, 'texture');
  gui.add(params, 'lighting', ['uniform', 'directional']);
  gui.add(params, 'mesh_size', 5, 200).onFinishChange(val => {
    params.mesh_size = Math.round(val);
    delete_obj(gl, params.obj);
    params.obj = make_sphere(gl, params.mesh_size);
  });
  gui.add(params, 'distance', 2, 30);
  gui.add(params, 'phi', -90, 90);
  
  gui.close();  // Start closed

  control_div.appendChild(gui.domElement);

//  alert('uints? + ' + uints_for_indices);
//  loadTexture(gl, '3_no_ice_clouds_1k.jpg', 
  loadTexture(gl, 'land_ocean_ice_cloud_2048.jpg', 
              texture => hello_world_allready(gl, params, texture));
}

function hello_world_allready(gl, params, texture) {
    if (!gl) {
        console.log("can't find any webgl");
        alert("Your browser does not support WebGL");
        return;
    }

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
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

    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    
    // Bind the texture to texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    let time_start = window.performance.now();
    function render(time_now) {
        const delta_time = time_now - time_start;
        let obj = params.obj;
        drawScene(gl, programInfo, obj.vertexBuffer, obj.colorBuffer,
                  obj.normalBuffer, obj.textureBuffer, 
                  obj.indexBuffer, obj.vertexCount, delta_time*0.001,
                  params.lighting, params.texture, params.distance,
                  params.phi);
        window.requestAnimationFrame(render);
    };
    window.requestAnimationFrame(render);
}

export default hello_world;



