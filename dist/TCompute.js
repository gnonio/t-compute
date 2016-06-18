(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.TCompute = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @author gnonio / http://www.euclidiana.pt
 *
 * Loosely based on weblas webgl ( https://github.com/waylonflinn/weblas/blob/master/lib/webgl.js )
 * and THREE WebGLRenderer ( https://github.com/mrdoob/three.js/blob/master/src/renderers/WebGLRenderer.js )
 *
 */



var _withTHREE = false

try {
	if ( Number( THREE.REVISION ) >= 76 ) {
		THREE.Compute = TCompute
		_withTHREE = true
	}
} catch ( error ) {}

module.exports = TCompute // Standalone

var _instances = []

var _shaderSources = {}

/**
 * Manages webgl context
 * 
 * @constructor
 * @param {Object} [renderer = TCompute] - Optional THREE.WebGLRenderer instance
 */
function TCompute( renderer ) {
	var gl,
		state

	_instances.push( this )

	if ( renderer === undefined ) {
		renderer = this
		var canvas = document.createElement('canvas')
		gl = canvas.getContext( 'experimental-webgl', {
			premultipliedAlpha: false, preserveDrawingBuffer: false
		} )
		state = new TComputeState( gl )
	} else {
		gl = renderer.context
		state = renderer.state
		state.resetGL = renderer.resetGLState
	}
	
	if ( gl === undefined )
		console.error( 'Unable to setup WebGL context.' )
	
	this.renderer = renderer
	this.context = gl
	this.state = state
	this.withTHREE = _withTHREE

	// Capabilities
	var float_support
	
	try {
		float_support = gl.getExtension( 'OES_texture_float' )
	} catch( error ) {}
	
	if ( !float_support ) {
		console.warn( 'No support for OES_texture_float extension.' )
		this.float_support = false
	} else {
		this.float_support = true
	}
	
	// Settings
	this.glSettings = {}
	this.glSettings.flipy = false
	
	// Compute Pass
	this.computePass = {}
	
	// Programs
	this.setupPrograms()
	
	// Quad Mesh
	this.setupBuffers()
	
	// Framebuffer
	this.setupFramebuffer()
}

TCompute.getInstances = function() {
	return _instances
}

TCompute.prototype.setupRenderer = function( renderer ) {
	// must dispose of programs, buffers and framebuffer if reinitializing
	
	var gl = renderer.context
	var state = renderer.state
	state.resetGL = renderer.resetGLState
	
	this.renderer = renderer
	this.context = gl
	this.state = state
}

// SETUP
TCompute.prototype.setupPrograms = function() {
	var gl = this.context
	
	// Shader common function sources
	this.functions_src = {
		modulo:				"float modulo( float x, float y ) {\r\n\treturn x - y * floor( ( x + 0.5 ) / ( y ) );\r\n}\r\n",
		getUV:				"vec2 getUV( float index, vec2 shape, vec2 halfp ) {\r\n\tfloat x = modulo( index, shape.x ); // custom mod function addressing float division rounding error\r\n\tfloat y = floor( ( index + 0.5 ) / shape.x ); // as above\r\n\t\r\n\treturn vec2( x * halfp.x * 2.0 + halfp.x, y * halfp.y * 2.0 + halfp.y );\r\n}\r\n",
		getUVvalue:			"float getUVvalue( sampler2D texture, int channel, vec2 xy ) {\r\n\tfloat value = 0.0;\r\n\tif ( channel == 0 ) {\r\n\t\tvalue = texture2D( texture, xy ).r;\r\n\t} else if ( channel == 1 ) {\r\n\t\tvalue = texture2D( texture, xy ).g;\r\n\t} else if ( channel == 2 ) {\r\n\t\tvalue = texture2D( texture, xy ).b;\r\n\t} else if ( channel == 3 ) {\r\n\t\tvalue = texture2D( texture, xy ).a;\r\n\t}\r\n\treturn value;\r\n}\r\n",
		getXY:				"vec2 getXY( vec2 uv, vec2 shape ) {\r\n\tfloat col_index = floor( uv.s * shape.x );\r\n\tfloat row_index = floor( uv.t * shape.y );\r\n\r\n\treturn vec2( col_index, row_index );\r\n}\r\n",
		get_indices:		"vec2 get_indices( float col_t, float cols, float row_t, float rows ) {\r\n\tfloat col_index = floor( col_t * cols );\r\n\tfloat row_index = floor( row_t * rows );\r\n\r\n\treturn vec2( col_index, row_index );\r\n}\r\n",
		get_coords:			"vec2 get_coords( float index, float cols, float cols_halfp, float rows, float row_halfp ) {\r\n\tfloat col_index = modulo( index, cols ); // custom mod function addressing float division rounding error\r\n\tfloat row_index = floor( ( index + 0.5 ) / cols ); // as above\r\n\t\r\n\treturn vec2( col_index * cols_halfp * 2.0 + cols_halfp, row_index * row_halfp * 2.0 + row_halfp );\r\n}\r\n",
		get_channel_value:	"float get_channel_value( sampler2D texture, int channel, vec2 xy ) {\r\n\tfloat value = 0.0;\r\n\tif ( channel == 0 ) {\r\n\t\tvalue = texture2D( texture, xy ).r;\r\n\t} else if ( channel == 1 ) {\r\n\t\tvalue = texture2D( texture, xy ).g;\r\n\t} else if ( channel == 2 ) {\r\n\t\tvalue = texture2D( texture, xy ).b;\r\n\t} else if ( channel == 3 ) {\r\n\t\tvalue = texture2D( texture, xy ).a;\r\n\t}\r\n\treturn value;\r\n}\r\n",
		set_channel_value:	"vec4 set_channel_value( int channel, float value ) {\t\r\n\tif ( channel == 0 ) {\r\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\r\n\t}\r\n\tif ( channel == 1 ) {\r\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\r\n\t}\r\n\tif ( channel == 2 ) {\r\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\r\n\t}\r\n\tif ( channel == 3 ) {\r\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\r\n\t}\t\r\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\r\n",
		mix_channel_value:	"vec4 mix_channel_value( vec4 rgba, int channel, float value ) {\t\r\n\tif ( channel == 0 ) {\r\n\t\trgba.r = value;\r\n\t}\r\n\tif ( channel == 1 ) {\r\n\t\trgba.g = value;\r\n\t}\r\n\tif ( channel == 2 ) {\r\n\t\trgba.b = value;\r\n\t}\r\n\tif ( channel == 3 ) {\r\n\t\trgba.a = value;\r\n\t}\r\n\treturn rgba;\r\n}\r\n"
	}
	_shaderSources.functions = this.functions_src
	
	// Shader main function sources
	this.main_src = {
		download:			"void main( void ) {\r\n\tfloat S = UVs.s;\r\n\tfloat T = UVs.t;\r\n\t#ifdef FLIPY\r\n\t\tT = 1.0 - UVs.t;\t\t\r\n\t#endif\r\n\r\n\tgl_FragColor = texture2D( A, vec2( S, T ) );\r\n}\r\n",
		download_packed:	"void main( void ) {\r\n\tfloat S = UVs.s;\r\n\tfloat T = UVs.t;\r\n\t#ifdef FLIPY\r\n\t\tT = 1.0 - UVs.t;\t\t\r\n\t#endif\r\n\r\n\t// get this pixel's row(.x) / column(.y) index\r\n\tvec2 PIXEL = getXY( vec2( S, T ), OUTshape );\r\n\r\n\t// get implied flat index ( as used in cpu buffers )\r\n\tfloat Pbuffer_i = PIXEL.y * OUTshape.x * OUTchannels + PIXEL.x * OUTchannels;\r\n\r\n\t// corresponding unpacked flat index sequence\r\n\tvec4 UPbuffer_i = vec4( Pbuffer_i, Pbuffer_i + 1.0, Pbuffer_i + 2.0, Pbuffer_i + 3.0 );\r\n\r\n\t// get the sequence of coordinates of unpacked texture\r\n\tvec2 UPs = getUV( UPbuffer_i.x, UPshape, UPhalfp );\r\n\tvec2 UPt = getUV( UPbuffer_i.y, UPshape, UPhalfp );\r\n\tvec2 UPp = getUV( UPbuffer_i.z, UPshape, UPhalfp );\r\n\tvec2 UPq = getUV( UPbuffer_i.w, UPshape, UPhalfp );\r\n\r\n\t// read sequence of four values from unpacked texture\r\n\tfloat r = getUVvalue( A, Achan, UPs );\r\n\tfloat g = getUVvalue( A, Achan, UPt );\r\n\tfloat b = getUVvalue( A, Achan, UPp );\r\n\tfloat a = getUVvalue( A, Achan, UPq );\r\n\r\n\t// output values PACKED\r\n\tgl_FragColor = vec4( r, g, b, a );\r\n}\r\n",
		read_packed:		"void main( void ) {\r\n\tgl_FragColor = texture2D( A, UVs );\r\n}\r\n",
		read_packed_padded:	"void main( void ) {\r\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\r\n\tfloat row_t = UVs.t;\r\n\t\r\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );\r\n\t\r\n\t// this pixel index as if unpacked (up_cols = cols * 4.0)\r\n\tfloat index = rowcol.y * up_cols + rowcol.x * 4.0;\r\n\t\r\n\t// expanded indices per channel\r\n\tfloat index_r = index + 0.1;\r\n\tfloat index_g = index + 1.1;\r\n\tfloat index_b = index + 2.1;\r\n\tfloat index_a = index + 3.1;\r\n\t\r\n\t// number of padded elements(pixels) up to this index\r\n\tfloat pads_r = floor( index_r / up_cols_padded );\r\n\tfloat pads_g = floor( index_g / up_cols_padded );\r\n\tfloat pads_b = floor( index_b / up_cols_padded );\r\n\tfloat pads_a = floor( index_a / up_cols_padded );\r\n\t\r\n\t// new index accounting padding\r\n\tfloat nindex_r = index_r + pads_r * pad;\r\n\tfloat nindex_g = index_g + pads_g * pad;\r\n\tfloat nindex_b = index_b + pads_b * pad;\r\n\tfloat nindex_a = index_a + pads_a * pad;\r\n\r\n\t// new channel based on new index ( these get shifted )\r\n\tfloat nchannel_r = floor( mod( nindex_r, 4.0 ) );\r\n\tfloat nchannel_g = floor( mod( nindex_g, 4.0 ) );\r\n\tfloat nchannel_b = floor( mod( nindex_b, 4.0 ) );\r\n\tfloat nchannel_a = floor( mod( nindex_a, 4.0 ) );\r\n\t\r\n\t// can be optimized, at most 2 pixels should be read\r\n\t// get the sequence of coordinates of texture as if unpacked\r\n\tvec2 up_s = get_coords( nindex_r, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_t = get_coords( nindex_g, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_p = get_coords( nindex_b, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_q = get_coords( nindex_a, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\t\r\n\t// read four values from texture considering the new channels \r\n\tfloat r = get_channel_value( A, int(nchannel_r), up_s );\r\n\tfloat g = get_channel_value( A, int(nchannel_g), up_t );\r\n\tfloat b = get_channel_value( A, int(nchannel_b), up_p );\r\n\tfloat a = get_channel_value( A, int(nchannel_a), up_q );\r\n\t\r\n\tgl_FragColor = vec4( r, g, b, a );\r\n}\r\n",
		duplicate:			"void main( void ) {\r\n\tfloat S = UVs.s;\r\n\tfloat T = UVs.t;\r\n\t#ifdef FLIPY\r\n\t\tT = 1.0 - UVs.t;\t\t\r\n\t#endif\r\n\r\n\tfloat A_value = get_channel_value( A, Achan, vec2( S, T ) );\r\n\tgl_FragColor = set_channel_value( OUTchan, A_value );\r\n}\r\n",
		duplicate_packed:	"void main( void ) {\r\n\tfloat S = UVs.s;\r\n\tfloat T = UVs.t;\r\n\t#ifdef FLIPY\r\n\t\tT = 1.0 - UVs.t;\t\t\r\n\t#endif\r\n\r\n\tgl_FragColor = texture2D( A, vec2( S, T ) );\r\n}\r\n",
		pack:				"void main( void ) {\r\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\r\n\tfloat row_t = UVs.t;\r\n\t\r\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );\r\n\t\r\n\t// unpacked row and column index (columns are multiplied by 4 channels)\r\n\tfloat up_col = rowcol.x * 4.0;\r\n\tfloat up_row = rowcol.y / OUTshape.y + OUThalfp.y;\r\n\t\r\n\t// set a sequence of four indices\r\n\tvec4 seq_col_indices = vec4( up_col, up_col + 1.0, up_col + 2.0, up_col + 3.0 );\r\n\t\r\n\t// get the sequence of coordinates of unpacked texture\r\n\tvec2 up_s = vec2( seq_col_indices.x / up_cols + up_col_hstep, up_row );\r\n\tvec2 up_t = vec2( seq_col_indices.y / up_cols + up_col_hstep, up_row );\r\n\tvec2 up_p = vec2( seq_col_indices.z / up_cols + up_col_hstep, up_row );\r\n\tvec2 up_q = vec2( seq_col_indices.w / up_cols + up_col_hstep, up_row );\r\n\t\r\n\t// read four values from unpacked texture\r\n\tfloat r = get_channel_value( A, Achan, up_s );\r\n\tfloat g = get_channel_value( A, Achan, up_t );\r\n\tfloat b = get_channel_value( A, Achan, up_p );\r\n\tfloat a = get_channel_value( A, Achan, up_q );\r\n\r\n\tgl_FragColor = vec4( r, g, b, a );\r\n}\r\n",
		unpack:				"void main( void ) {\r\n\tfloat col_t = UVs.s;\r\n\tfloat row_t = UVs.t;\r\n\r\n\tvec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );\r\n\tfloat p_col_index = floor( rowcol.x / 4.0 );\r\n\tfloat p_index = floor( rowcol.y * p_cols + p_col_index ); //  + 0.1\r\n\r\n\tint Achan = int( mod( rowcol.x, 4.0 ) );\r\n\tvec2 packed_st = get_coords( p_index, p_cols, p_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tfloat value = get_channel_value( A, Achan, packed_st );\r\n\r\n\tgl_FragColor = set_channel_value( OUTchan, value );\r\n}\r\n",
		transpose:			"void main( void ) {\t\r\n\tfloat value = get_channel_value( A, Achan, vec2( UVs.y, UVs.x ) );\t\r\n\tgl_FragColor = set_channel_value( OUTchan, value );\r\n}"
	}
	_shaderSources.main = this.main_src
	
	// Shader sources
	this.shaders_src = {
		pass_through:		"// Quad pass-through\r\nprecision highp float;\r\n\r\nattribute vec3 position;\r\nattribute vec2 uv;\r\nvarying vec2   UVs;\r\n\r\nvoid main( void ) {\r\n\tgl_Position = vec4( position, 1.0 );\r\n\tUVs = uv;\r\n}\r\n"
	}
	_shaderSources.shaders = this.shaders_src

	// Create Shaders	
	this.shaders = {}
	this.shaders.pass_through = this.setupShader( this.shaders_src.pass_through, gl.VERTEX_SHADER )
	
	// Create Programs
	this.programs = {}
}

TCompute.prototype.setupShader = function( shader_source, type ) {
	var gl = this.context

	// Compile shader
	var shader = gl.createShader( type )
	gl.shaderSource( shader, shader_source )
	gl.compileShader( shader )

	// Check compile
	var shaderInfoLog = gl.getShaderInfoLog( shader )
	
	if ( gl.getShaderParameter( shader, gl.COMPILE_STATUS ) === false ) {
		console.error( 'setupShader(): Shader compile failed.' )
	}
	if ( shaderInfoLog !== '' ) {
		console.warn( 'setupShader(): ', type === gl.VERTEX_SHADER ? 'vertex' : 'fragment' )
		console.warn( 'gl.getShaderInfoLog(): ', shaderInfoLog, addLineNumbers( shader_source ) )
	}
	
	return shader
}

TCompute.prototype.setupProgram = function( vertexShader, fragmentShader ) {
	var gl = this.context

	// Link program
	var program = gl.createProgram()
	gl.attachShader( program, vertexShader )
	gl.attachShader( program, fragmentShader )
	gl.linkProgram( program )
	
	// Check link
	var programInfoLog = gl.getProgramInfoLog( program )
	
	if ( gl.getProgramParameter( program, gl.LINK_STATUS ) === false ) {
		console.error( 'setupProgram(): ', gl.getError() )
		console.error( 'gl.VALIDATE_STATUS: ', gl.getProgramParameter( program, gl.VALIDATE_STATUS ) )
		console.error( 'gl.getProgramInfoLog(): ', programInfoLog )
	}
	if ( programInfoLog !== '' ) {
		console.warn( 'setupProgram(): ' )
		console.warn( 'gl.getProgramInfoLog(): ', programInfoLog )
	}

	return program
}

TCompute.prototype.addProgram = function( name, shader_source ) {
	var gl = this.context

	this.shaders_src[ name ] = shader_source
	
	this.shaders[ name ] = this.setupShader( this.shaders_src[ name ], gl.FRAGMENT_SHADER )
	this.programs[ name ]= this.setupProgram( this.shaders.pass_through, this.shaders[ name ] )
}

TCompute.prototype.setupBuffers = function() {
	var gl = this.context
	
	this.buffers = {}
	
	var framequad = {}

	// Quad Vertices
	framequad.vertices = {
		attribute: 'position',
		buffer: gl.createBuffer(),
		data: new Float32Array( [
			-1.0, -1.0, 0.0,	// bottom left
			 1.0, -1.0, 0.0,	// bottom right
			 1.0,  1.0, 0.0,	// top right
			-1.0,  1.0, 0.0		// top left
		] )
	}
	gl.bindBuffer( gl.ARRAY_BUFFER, framequad.vertices.buffer )
	gl.bufferData( gl.ARRAY_BUFFER, framequad.vertices.data, gl.STATIC_DRAW )

	// Quad UVs
	framequad.uvs = {
		attribute: 'uv',
		buffer: gl.createBuffer(),
		data: new Float32Array( [
			0.0, 0.0,
			1.0, 0.0,
			1.0, 1.0,
			0.0, 1.0
		] )
	}
	gl.bindBuffer( gl.ARRAY_BUFFER, framequad.uvs.buffer )
	gl.bufferData( gl.ARRAY_BUFFER, framequad.uvs.data, gl.STATIC_DRAW )

	// Quad Elements
	framequad.elements = {
		length: 6,
		buffer: gl.createBuffer(),
		data: new Uint16Array( [
			0, 1, 2,	// bottom right triangle
			0, 2, 3		// top left triangle
		] )
	}
	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, framequad.elements.buffer )
	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, framequad.elements.data, gl.STATIC_DRAW )
	
	this.buffers.framequad = framequad
}

TCompute.prototype.setupFramebuffer = function() {
	var gl = this.context
	
	var currentViewport = gl.getParameter( gl.VIEWPORT )
	var targetViewport = { x: 0, y: 0, z: 2, w: 2 }
	
	this.state.viewport( targetViewport )
	
	this.framebuffer = gl.createFramebuffer()
	this.fbTexture = this.setupTexture( [ 2, 2 ], null, gl.RGBA, gl.FLOAT )
	
	this.state.bindTexture( gl.TEXTURE_2D, this.fbTexture )
	
	this.state.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.FLOAT, null )
	gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer )
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fbTexture, 0 )

	if( gl.checkFramebufferStatus( gl.FRAMEBUFFER ) != gl.FRAMEBUFFER_COMPLETE )
		console.error( 'bindFramebuffer(): Framebuffer not complete' )

	gl.bindFramebuffer( gl.FRAMEBUFFER, null )
}

/* Create a texture for both input and output
 */
TCompute.prototype.setupTexture = function( shape, data, glFormat, glType ) {
	var gl = this.context
	
	/*var W = packed ? Math.ceil( N / 4 ) : N
	var H = M*/
	
	var width = shape[ 1 ]
	var height = shape[ 0 ]

	var texture = gl.createTexture()
	
	/*texture.width = W
	texture.height = H*/
	
	this.state.bindTexture( gl.TEXTURE_2D, texture )
	
	gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, this.glSettings.flipy )
	gl.pixelStorei( gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false )
	//gl.pixelStorei( gl.UNPACK_ALIGNMENT, 4 )

	this.state.texImage2D( gl.TEXTURE_2D, 0, glFormat, width, height, 0, glFormat, glType, data )
	
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE )

	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	
	this.state.bindTexture( gl.TEXTURE_2D, null )

	return texture
}


// BINDING
TCompute.prototype.bindBuffers = function( objects ) {
	var gl = this.context

	var position = gl.getAttribLocation( this.computePass.program, objects.vertices.attribute )
	var uv = gl.getAttribLocation( this.computePass.program, objects.uvs.attribute )

	this.state.initAttributes()
	this.state.enableAttribute( position )
	this.state.enableAttribute( uv )
	this.state.disableUnusedAttributes()

	gl.bindBuffer( gl.ARRAY_BUFFER, objects.vertices.buffer )
	gl.vertexAttribPointer( position, 3, gl.FLOAT, false, 0, 0 )

	gl.bindBuffer( gl.ARRAY_BUFFER, objects.uvs.buffer )
	gl.vertexAttribPointer( uv, 2, gl.FLOAT, false, 0, 0 )

	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, objects.elements.buffer )
}

TCompute.prototype.bindFramebuffer = function( framebuffer ) {
	var gl = this.context
	
	//var currentViewport = gl.getParameter( gl.VIEWPORT )
	var viewport = { x: 0, y: 0, z: framebuffer.width, w: framebuffer.height }
	//viewportsEqual( currentViewport, viewport )
	
	this.state.viewport( viewport )
	
	gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer )
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, framebuffer.texture, 0 )

	if( gl.checkFramebufferStatus( gl.FRAMEBUFFER ) != gl.FRAMEBUFFER_COMPLETE )
		console.error( 'bindFramebuffer(): Framebuffer not complete' )
	
	var uniforms = {}

	if ( framebuffer.bindChannel ) {
		uniforms[ 'OUTchan' ] = { type: 'uniform1i', value: framebuffer.channel }
	}

	if ( framebuffer.bindShape ) {
		var W = framebuffer.width
		var Whs = ( 1 / W ) * 0.5
		var H = framebuffer.height
		var Hhs = ( 1 / H ) * 0.5
		
		uniforms[ 'OUTshape' ] = { type: 'uniform2fv', value: new Float32Array( [ W, H ] ) }
		uniforms[ 'OUThalfp' ] = { type: 'uniform2fv', value: new Float32Array( [ Whs, Hhs ] ) }
	}

	this.bindUniforms( uniforms )
}

TCompute.prototype.bindUniforms = function( uniforms ) {
	var gl = this.context

	for ( var location in uniforms ) {
		var uniform = uniforms[ location ]
		
		var uniform_gl = gl.getUniformLocation( this.computePass.program, location )
		gl[ uniform.type ]( uniform_gl, uniform.value )
	}
}

TCompute.prototype.bindTextures = function( textures ) {
	var gl = this.context

	var unit = 0
	for ( var location in textures ) {
		var tensor = textures[ location ].value

		// sampler2D
		this.state.activeTexture( gl.TEXTURE0 + unit )	
		this.state.bindTexture( gl.TEXTURE_2D, tensor.texture )
		
		var uniform_gl = gl.getUniformLocation( this.computePass.program, location )
		gl.uniform1i( uniform_gl, unit )

		// Optional associated uniforms
		var uniforms = {}

		if ( textures[ location ].bindChannel ) {
			uniforms[ location + 'chan' ] = { type: 'uniform1i', value: tensor.channel }
		}

		if ( textures[ location ].bindShape ) {
			var W = tensor.shape[ 1 ]
			var Whs = ( 1 / W ) * 0.5
			var H = tensor.shape[ 0 ]
			var Hhs = ( 1 / H ) * 0.5
			
			uniforms[ location + 'shape' ] = { type: 'uniform2fv', value: new Float32Array( [ W, H ] ) }
			uniforms[ location + 'halfp' ] = { type: 'uniform2fv', value: new Float32Array( [ Whs, Hhs ] ) }
		}

		this.bindUniforms( uniforms )

		unit++
	}
}

TCompute.prototype.unbindTextures = function( textures ) {
	var gl = this.context
	
	var unit = 0
	for ( var texture in textures ) {
		//this.unbindTexture( unit )
		this.state.activeTexture( gl.TEXTURE0 + unit )	
		this.state.bindTexture(	gl.TEXTURE_2D, null )
		
		unit++
	}
}

// SHADER GENERATION
TCompute.prototype.gatherVaryings = function() {
	// compose string
	var varyings_str = ''

	varyings_str += 'varying vec2\t\tUVs;\r\n'
	
	return varyings_str + '\r\n'
}
TCompute.prototype.gatherSettings = function() {
	// compose string
	var settings_str = ''
	
	settings_str += 'precision highp float;\r\n'
	settings_str += 'const float OUTchannels = 4.0;\r\n'
	
	for ( var s in this.computePass.settings ) {
		if ( this.computePass.settings[ s ] ) settings_str += '#define ' + s.toUpperCase() + '\r\n'
	}
	
	return settings_str + '\r\n'
}

TCompute.prototype.gatherUniforms = function() {
	var uniforms = {}
	
	//var objects = this.computePass.objects	
	
	if ( this.computePass.framebuffer.bindChannel ) {
		uniforms[ 'OUTchan' ] = { type: 'int\t\t', comment: '\t\t// Output channel' }
	}
	
	if ( this.computePass.framebuffer.bindShape ) {		
		uniforms[ 'OUTshape' ]	= { type: 'vec2\t', comment: '\t\t// Shape: .x = columns, .y = rows' }
		uniforms[ 'OUThalfp' ]	= { type: 'vec2\t', comment: '\t\t// Half pixel: .x = width, .y = height ' }
	}

	
	var data = this.computePass.data
	var type = {
		'uniform1f': 	'float\t',
		'uniform1i': 	'int\t\t',
		'uniform2fv': 	'vec2\t',
		'sampler2D': 	'sampler2D'
	}
	for ( var d in data ) {
		uniforms[ d ] = { type: type[ data[ d ].type ], comment: '\t\t// ' + data[ d ].comment || '' }
	}


	var textures = this.computePass.textures
	for ( var t in textures ) {		
		uniforms[ t ] = { type: 'sampler2D', comment: '\t\t\t\t// Texture data' }
		
		if ( textures[ t ].bindChannel ) {
			uniforms[ t + 'chan' ] 	= { type: 'int\t\t', comment: '\t\t\t// Texture channel' }
		}
		
		if ( textures[ t ].bindShape ) {
			
			uniforms[ t + 'shape' ]	= { type: 'vec2\t' }
			uniforms[ t + 'halfp' ]	= { type: 'vec2\t' }
		}
	}

	// compose string
	var str_uniforms = ''
	for ( var u in uniforms ) {
		var uniform = uniforms[ u ]
		var type = uniform.type
		var comment = uniform.comment || ''
		str_uniforms += 'uniform ' + type + '\t ' + u + ';\t' + comment + '\r\n'
	}
	
	return str_uniforms + '\r\n'
}

TCompute.prototype.gatherFunctions = function() {
	var found_functions = {}
	var ffnames = ''
	
	// check for functions in main source, mantain order
	for ( var name in _shaderSources.functions ) {
		var source = _shaderSources.functions[ name ]
		var functionPosition = this.computePass.main.indexOf( String( name ) )		
		if ( functionPosition > -1 ) {
			found_functions[ functionPosition + 10000 ] = { name: name, source: source }
			ffnames += name + ' '
			
		}
	}
	// check for functions within found functions, mantain order, prevent duplicates
	var fc = 0
	for ( var name in _shaderSources.functions ) {
		var source = _shaderSources.functions[ name ]
		for ( var ff in found_functions ) {
			var ffname = found_functions[ ff ].name
			var ffsource = found_functions[ ff ].source			
			var notfoundyet = !ffnames.includes( String( name ) )
			if ( ffsource.includes( String( name ) ) && notfoundyet ) {
				found_functions[ fc ] = { name: name, source: source }
				ffnames += name + ' '
			}			
		}
		fc++
	}
	
	// compose string
	var functions_str = ''
	for ( var f in found_functions ) {
		functions_str += found_functions[ f ].source
	}
	return functions_str + '\r\n'
}

TCompute.prototype.generateProgram = function( program_name, debug ) {
	var gl = this.context
	
	var program_name = 'gen_' + program_name
	
	if ( !this.programs.hasOwnProperty( program_name ) ) {
		// VERTEX
		//vertex_src += '// ATTRIBUTES\r\n'
		//var attributes = this.gatherAttributes()

		// FRAGMENT
		var frag_src = '// Shader: ' + program_name + '\r\n'
		frag_src += '\r\n'
		
		frag_src += '// SETTINGS\r\n'
		frag_src += this.gatherSettings()
		
		frag_src += '// VARYINGS\r\n'
		frag_src += this.gatherVaryings()
		
		frag_src += '// UNIFORMS\r\n'
		frag_src += this.gatherUniforms()
		
		frag_src += '// FUNCTIONS\r\n'
		frag_src += this.gatherFunctions()

		frag_src += '// MAIN\r\n'
		frag_src += this.computePass.main + '\r\n'
		
		if ( debug ) console.log( frag_src )

		// Update cache
		this.shaders_src[ program_name ] = frag_src
		this.shaders[ program_name ] = this.setupShader( frag_src, gl.FRAGMENT_SHADER )
		this.programs[ program_name ] = this.setupProgram( this.shaders.pass_through, this.shaders[ program_name ] )
		console.log( 'generateProgram(): ' + program_name + ' program added.')
	}
	return this.programs[ program_name ]
}

TCompute.prototype.renderPass = function() {
	var gl = this.context
	
	// TODO: binds caching, if sharing context how to inspect externally bound buffers?
	
	gl.useProgram( this.computePass.program )
	
	this.bindBuffers( this.computePass.objects )
	
	this.bindFramebuffer( this.computePass.framebuffer )
	
	this.bindUniforms( this.computePass.data )
	
	this.bindTextures( this.computePass.textures )
	
	gl.drawElements( gl.TRIANGLES, this.computePass.objects.elements.length, gl.UNSIGNED_SHORT, 0 )
	
	this.unbindTextures( this.computePass.textures )
	
	// handoff context
	this.state.resetGL()
}

/* Read data out as floats
	for ouput purposes only we are 'deferring' all null data (found in padded textures)
	to the end of the array instead of having padded 0s per each row to prevent any user postprocessing
	this is done at the shader level but must be handled when generating the CPU array
*/
TCompute.prototype.readFramebuffer = function( shape ) {
	var gl = this.context

	var W = shape[ 1 ]
	var H = shape[ 0 ]
	var size = H * W * Float32Array.BYTES_PER_ELEMENT * 4

	// create destination buffer
	var rawbuffer = new ArrayBuffer( size )
	
	var readBuffer = new Float32Array( rawbuffer )
	gl.readPixels( 0, 0, W, H, gl.RGBA, gl.FLOAT, readBuffer )

	return readBuffer.subarray( 0, size )
}

/*	float texture read, allows output as packed+deferred or unpacked
 */
TCompute.prototype.download = function( output, asPacked, tensor ) {
	var objects,
		framebuffer,
		data = {},
		textures = {},
		settings = {},
		main,
		program_name

	// Objects
	objects = this.buffers.framequad

	// Framebuffer
	// TODO: pass a 'out' tensor object instead of texture,
	// to facilitade framebuffer / settings configuration
	var M = tensor.shape[ 0 ]
	var N = tensor.shape[ 1 ]
	/*var shape = [ M, N ]
	
	var out = gl.setupTexture( shape, null, gl.context.RGBA, gl.context.FLOAT )*/
	
	framebuffer = { width: N, height: M, texture: output, channel: tensor.channel || 0, bindChannel: false, bindShape: true }

	// Data

	// Textures
	textures.A = { type: 'sampler2D', value: tensor, bindChannel: true, bindShape: true }

	// GLSL Settings
	// TODO: tie settings to passed textures? may disallow some shader caching
	// some settings should be prefilled in any case
	settings.flipy = this.glSettings.flipy

	// GLSL Main
	main = this.main_src.download

	// GLSL Name
	program_name = 'download'

	if ( asPacked ) {
		// GLSL Option Name
		program_name += '_asPacked'

		framebuffer.width = Math.ceil( N / 4 )
		
		var glsl_shape = get_glsl_shape( tensor.shape )
		var normalised_shape_halved = normalise_half( glsl_shape )
		
		data = {
			UPshape: { type: 'uniform2fv', value: new Float32Array( glsl_shape ), comment: 'Unpacked shape' },
			UPhalfp: { type: 'uniform2fv', value: new Float32Array( normalised_shape_halved ), comment: 'Unpacked half pixel' }
		}

		// Textures

		// GLSL Settings
		settings.packed = asPacked

		// GLSL Main
		main = this.main_src.download_packed
	}

	// Shader generation
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		settings: 		settings,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, false )

	this.renderPass()
}

/*	direct texture float data read (no float encode) - requires OES_texture_float support
 */
TCompute.prototype.read = function( M, N, tensor, out ) {
	// Objects
	var objects = this.buffers.framequad

	var framebuffer = { width: N, height: M, texture: out, channel: out.channel || 0, bindChannel: false, bindShape: true }

	var data = {}

	if ( tensor.requires_padding ) {
		var W = Math.ceil( N / 4 )
		var H = M
		
		framebuffer.width = W
		
		var pad = W * 4 - N
		
		data = {			
			up_cols: 		{ type: 'uniform1f', value: W * 4 },
			up_col_hstep: 	{ type: 'uniform1f', value: ( 1 / (W * 4) ) * 0.5 },
			
			pad: 			{ type: 'uniform1f', value: pad },
			up_cols_padded: { type: 'uniform1f', value: W * 4 - pad }
		}
	}
	
	var textures = {}	
	textures.A = { type: 'sampler2D', value: tensor, bindChannel: false, bindShape: false }

	// GLSL Functions
	var functions = {}
	if ( tensor.requires_padding ) {
		functions.get_indices 		= this.functions_src.get_indices
		functions.get_coords 		= this.functions_src.get_coords
		functions.get_channel_value = this.functions_src.get_channel_value
	}

	// GLSL Main
	var main = tensor.requires_padding ? this.main_src.read_packed_padded : this.main_src.read_packed

	var program_name = 'read_packed' + ( tensor.requires_padding ? '_padded' : '' )
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, false )

	this.renderPass()
}

/*	duplicate texture (use in iterative calculations)
 */
TCompute.prototype.duplicate = function( M, N, tensor, out, packed ) {
	var objects = this.buffers.framequad

	var framebuffer = { width: N, height: M, texture: out.texture, channel: out.channel || 0, bindChannel: true, bindShape: true }
	
	var data = {}
	
	var textures = {}
	textures.A = { type: 'sampler2D', value: tensor, bindChannel: true, bindShape: false }

	// GLSL Main
	//var flipy = tensor.isInput ? '' : '' // '#define FLIPY\r\n'
	var main = packed ? this.main_src.duplicate_packed : this.main_src.duplicate
	
	// Shader generation
	var program_name = 'duplicate' + ( packed ? '_packed' : '' )
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, false )
	
	this.renderPass()
}

/*	used to convert a unpacked texture into a packed texture
 */
TCompute.prototype.pack = function( M, N, tensor, out ) {
	var objects = this.buffers.framequad
	
	var framebuffer = { width: N, height: M, texture: out, channel: out.channel || 0, bindChannel: true, bindShape: true }
	
	var data = {}

	var W = Math.ceil( N / 4 )
	var H = M
	
	data = {		
		up_cols: 		{ type: 'uniform1f', value: N },
		up_col_hstep: 	{ type: 'uniform1f', value: ( 1 / N ) * 0.5 }
	}

	var textures = {}

	textures.A = { type: 'sampler2D', value: tensor, bindChannel: true, bindShape: false }

	// GLSL Functions
	var functions = {}
	functions.get_indices 		= this.functions_src.get_indices
	functions.get_coords 		= this.functions_src.get_coords
	functions.get_channel_value = this.functions_src.get_channel_value

	// GLSL Main
	var main = this.main_src.pack

	var program_name = 'pack'
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, false )
	
	this.renderPass()
}

/*	used to convert a packed texture (data is held in all RGBA channels)
	into an unpacked texture (data is held in a selected channel)
 */
TCompute.prototype.unpack = function( M, N, tensor, out ) {
	var objects = this.buffers.framequad

	var framebuffer = { width: N, height: M, texture: out, channel: tensor.channel, bindChannel: true, bindShape: true }

	var data = {}

	var W = N
	var H = M
	
	var p_cols = Math.ceil( W / 4 )
	var p_col_hstep = ( 1 / p_cols ) * 0.5
	//console.log( 'unpack', p_cols, p_col_hstep )

	data = {
		p_cols: 		{ type: 'uniform1f', value: p_cols },
		p_col_hstep: 	{ type: 'uniform1f', value: p_col_hstep }
	}

	var textures = {}

	textures.A = { type: 'sampler2D', value: tensor, bindChannel: false, bindShape: false }

	// GLSL Functions
	var functions = {}
	functions.get_indices 		= this.functions_src.get_indices
	functions.get_coords 		= this.functions_src.get_coords
	functions.get_channel_value = this.functions_src.get_channel_value
	functions.set_channel_value = this.functions_src.set_channel_value

	// GLSL Main
	var main = this.main_src.unpack

	var program_name = 'unpack'
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, false )
	
	this.renderPass()
}

/* tranpose a texture where input has M rows and N columns
 */
TCompute.prototype.transpose = function( M, N, tensor, out ) {
	var objects = this.buffers.framequad
	
	// WARNING! switched M | N for transpose
	var framebuffer = { width: M, height: N, texture: out.texture, channel: out.channel || 0, bindChannel: true, bindShape: false }
	
	var data = {}

	var textures = {}

	textures.A = { type: 'sampler2D', value: tensor, bindChannel: true, bindShape: false }
	
	// GLSL Functions
	var functions = {}
	
	functions.get_channel_value = this.functions_src.get_channel_value
	functions.set_channel_value = this.functions_src.set_channel_value
	
	// GLSL Main
	var main = this.main_src.transpose

	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}
	
	this.computePass.program = this.generateProgram( 'transpose', false )
	
	this.renderPass()
}

/*	combine texture channels
 */
TCompute.prototype.mixin = function( M, N, red, green, blue, alpha, mix ) {
	var objects = this.buffers.framequad
	
	var framebuffer = { width: N, height: M, texture: mix.texture, channel: mix.channel || 0, bindChannel: false, bindShape: false }
	
	var data = {}
	var textures = {}

	if ( red != null ) textures.RED 	= { type: 'sampler2D', value: red, bindChannel: true, bindShape: false }
	if ( green != null ) textures.GREEN = { type: 'sampler2D', value: green, bindChannel: true, bindShape: false }
	if ( blue != null )	textures.BLUE 	= { type: 'sampler2D', value: blue, bindChannel: true, bindShape: false }
	if ( alpha != null ) textures.ALPHA = { type: 'sampler2D', value: alpha, bindChannel: true, bindShape: false }
	
	// GLSL Functions
	var functions = {}	
	functions.get_channel_value = this.functions_src.get_channel_value
	
	// GLSL Main
	var main = this.generate_mixin_main( red, green, blue, alpha )
	
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main.source
	}
	
	this.computePass.program = this.generateProgram( main.name, false )
	
	this.renderPass()
}

TCompute.prototype.generate_mixin_main = function( red, green, blue, alpha ) {
	var gl = this.context
	
	var r = red != null ? 'r' : 'n'
	var g = green != null ? 'g' : 'n'
	var b = blue != null ? 'b' : 'n'
	var a = alpha != null ? 'a' : 'n'
	
	// compose name along the pattern "mixin_rgba_program"
	// where each channel is replaced with "n" if null
	var program_name = 'mixin_' + r + g + b + a// + '_program'
	
	var frag_src = ''
	
	// generate only if source is inexistent
	if ( !this.main_src.hasOwnProperty( program_name ) ) {

		frag_src = 'void main( void ) {\r\n'

		var uniforms = { 'RED': red, 'GREEN': green, 'BLUE': blue, 'ALPHA': alpha }
		var values = { 'RED': '0.0', 'GREEN': '0.0', 'BLUE': '0.0', 'ALPHA': '0.0' }

		for ( var key in uniforms ) {
			if ( uniforms[ key ] != null ) {
				frag_src += '\tfloat ' + key + ' = get_channel_value( ' + key + ', ' + key + 'chan, UVs );\r\n'

				values[ key ] = key
			}
		}

		var glfragcolor = '\tgl_FragColor = vec4( ' + values[ 'RED' ] + ', ' +
													values[ 'GREEN' ] + ', ' +
													values[ 'BLUE' ] + ', ' +
													values[ 'ALPHA' ] + ' );\r\n'

		frag_src += glfragcolor		
		frag_src += '}\r\n'
		
		this.main_src[ program_name ] = frag_src

	}
	return { name: program_name, source: frag_src }
}

/*	Basic wraper for some gl methods if THREE not present
	allows sharing of webgl context
 */
function TComputeState( gl ) {
	this.gl = gl
}

TComputeState.prototype.initAttributes = function() {}

TComputeState.prototype.enableAttribute = function( attribute ) {
	this.gl.enableVertexAttribArray( attribute )
}

TComputeState.prototype.disableUnusedAttributes = function() {}
	
TComputeState.prototype.activeTexture = function( unit ) {
	this.gl.activeTexture( unit )
}

TComputeState.prototype.bindTexture = function( textureType, texture ) {
	this.gl.bindTexture( textureType, texture )
}

TComputeState.prototype.texImage2D = function() {
	this.gl.texImage2D.apply( this.gl, arguments )
}

TComputeState.prototype.viewport = function( viewport ) {
	this.gl.viewport( viewport.x, viewport.y, viewport.z, viewport.w )
}

TComputeState.prototype.resetGL = function() {}

// Utils
// User informs shape of matrix following M x N ( rows x columns ) notation as in math
// inside glsl the convention adopted to refer to rows and columns is .y and .x respectively
// as in x = abscissa and y = ordinate
// this 
function get_glsl_shape( shape ) {
	return [ shape[ 1 ], shape[ 0 ] ]
}
// normalised shape, for use within shaders
function normalise( glsl_shape ) {
	return [ 1 / glsl_shape[ 0 ], 1 / glsl_shape[ 1 ] ]
}
// normalised shape pre-halved, to shorten in-glsl computations
function normalise_half( glsl_shape ) {
	return [ 0.5 / glsl_shape[ 0 ], 0.5 / glsl_shape[ 1 ] ]
}
// check viewports
function viewportsEqual( cv, tv ) {
	if ( cv[0] === tv.x && cv[1] === tv.y && cv[2] === tv.z && cv[3] === tv.w ) {
		return true
	} else {
		return false
	}
}
// addLineNumbers from THREE.WebGLShader
function addLineNumbers( string ) {
	var lines = string.split( '\n' )
	for ( var i = 0; i < lines.length; i ++ ) {
		lines[ i ] = ( i + 1 ) + ': ' + lines[ i ]
	}
	return lines.join( '\n' )
}
},{}]},{},[1])(1)
});