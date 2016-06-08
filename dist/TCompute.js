(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.TCompute = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @author gnonio / http://www.euclidiana.pt
 *
 * Loosely based on weblas webgl ( https://github.com/waylonflinn/weblas/blob/master/lib/webgl.js )
 * and THREE WebGLRenderer ( https://github.com/mrdoob/three.js/blob/master/src/renderers/WebGLRenderer.js )
 *
 */



try {
	if ( Number( THREE.REVISION ) >= 76 ) {
		THREE.Compute = TCompute
	}
} catch ( error ) {}

module.exports = TCompute // Standalone

/**
 * Manages webgl context
 * 
 * @constructor
 * @param {Object} [renderer = TCompute] - Optional THREE.WebGLRenderer instance
 */
function TCompute( renderer ) {
	var gl,
		state

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
	
	// Compute Pass
	this.computePass = {}
	
	// Programs
	this.setupPrograms()
	
	// Quad Mesh
	this.setupBuffers()
	
	// Framebuffer
	this.setupFramebuffer()
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
		get_indices:		"vec2 get_indices( float col_t, float cols, float row_t, float rows ) {\r\n\tfloat col_index = floor( col_t * cols );\r\n\tfloat row_index = floor( row_t * rows );\r\n\r\n\treturn vec2( col_index, row_index );\r\n}\r\n",
		get_coords:			"vec2 get_coords( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\r\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\r\n\r\n\t//float index = row_index * cols + col_index;\r\n\r\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\r\n}\r\n",
		get_channel_value:	"float get_channel_value( sampler2D texture, int channel, vec2 xy ) {\r\n\tfloat value = 0.0;\r\n\tif ( channel == 0 ) {\r\n\t\tvalue = texture2D( texture, xy ).r;\r\n\t} else if ( channel == 1 ) {\r\n\t\tvalue = texture2D( texture, xy ).g;\r\n\t} else if ( channel == 2 ) {\r\n\t\tvalue = texture2D( texture, xy ).b;\r\n\t} else if ( channel == 3 ) {\r\n\t\tvalue = texture2D( texture, xy ).a;\r\n\t}\r\n\treturn value;\r\n}\r\n",
		set_channel_value:	"vec4 set_channel_value( int channel, float value ) {\t\r\n\tif ( channel == 0 ) {\r\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\r\n\t}\r\n\tif ( channel == 1 ) {\r\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\r\n\t}\r\n\tif ( channel == 2 ) {\r\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\r\n\t}\r\n\tif ( channel == 3 ) {\r\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\r\n\t}\t\r\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\r\n",
		mix_channel_value:	"vec4 mix_channel_value( vec4 rgba, int channel, float value ) {\t\r\n\tif ( channel == 0 ) {\r\n\t\trgba.r = value;\r\n\t}\r\n\tif ( channel == 1 ) {\r\n\t\trgba.g = value;\r\n\t}\r\n\tif ( channel == 2 ) {\r\n\t\trgba.b = value;\r\n\t}\r\n\tif ( channel == 3 ) {\r\n\t\trgba.a = value;\r\n\t}\r\n\treturn rgba;\r\n}\r\n"
	}
	
	// Shader main function sources
	this.main_src = {
		render_unpacked:	"void main( void ) {\r\n\tgl_FragColor = texture2D( A, UVs );\r\n}\r\n",
		render_packed:		"void main( void ) {\r\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\r\n\tfloat row_t = UVs.t;\r\n\r\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );\r\n\r\n\t// unpacked index (columns are multiplied by 4 channels)\r\n\tfloat up_index = rowcol.y * OUTshape.x * 4.0 + rowcol.x * 4.0;\r\n\r\n\t// set a sequence of four indices\r\n\tvec4 seq_indices = vec4( up_index, up_index + 1.0, up_index + 2.0, up_index + 3.0 );\r\n\r\n\t// get the sequence of coordinates of unpacked texture\r\n\tvec2 up_s = get_coords( seq_indices.x, up_cols_padded, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_t = get_coords( seq_indices.y, up_cols_padded, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_p = get_coords( seq_indices.z, up_cols_padded, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_q = get_coords( seq_indices.w, up_cols_padded, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\r\n\t// read four values from unpacked texture\r\n\tfloat r = get_channel_value( A, Achan, up_s );\r\n\tfloat g = get_channel_value( A, Achan, up_t );\r\n\tfloat b = get_channel_value( A, Achan, up_p );\r\n\tfloat a = get_channel_value( A, Achan, up_q );\r\n\r\n\tgl_FragColor = vec4( r, g, b, a );\r\n}\r\n",
		read_packed:		"void main( void ) {\r\n\tgl_FragColor = texture2D( A, UVs );\r\n}\r\n",
		read_packed_padded:	"void main( void ) {\r\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\r\n\tfloat row_t = UVs.t;\r\n\t\r\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );\r\n\t\r\n\t// this pixel index as if unpacked (up_cols = cols * 4.0)\r\n\tfloat index = rowcol.y * up_cols + rowcol.x * 4.0;\r\n\t\r\n\t// expanded indices per channel\r\n\tfloat index_r = index + 0.1;\r\n\tfloat index_g = index + 1.1;\r\n\tfloat index_b = index + 2.1;\r\n\tfloat index_a = index + 3.1;\r\n\t\r\n\t// number of padded elements(pixels) up to this index\r\n\tfloat pads_r = floor( index_r / up_cols_padded );\r\n\tfloat pads_g = floor( index_g / up_cols_padded );\r\n\tfloat pads_b = floor( index_b / up_cols_padded );\r\n\tfloat pads_a = floor( index_a / up_cols_padded );\r\n\t\r\n\t// new index accounting padding\r\n\tfloat nindex_r = index_r + pads_r * pad;\r\n\tfloat nindex_g = index_g + pads_g * pad;\r\n\tfloat nindex_b = index_b + pads_b * pad;\r\n\tfloat nindex_a = index_a + pads_a * pad;\r\n\r\n\t// new channel based on new index ( these get shifted )\r\n\tfloat nchannel_r = floor( mod( nindex_r, 4.0 ) );\r\n\tfloat nchannel_g = floor( mod( nindex_g, 4.0 ) );\r\n\tfloat nchannel_b = floor( mod( nindex_b, 4.0 ) );\r\n\tfloat nchannel_a = floor( mod( nindex_a, 4.0 ) );\r\n\t\r\n\t// can be optimized, at most 2 pixels should be read\r\n\t// get the sequence of coordinates of texture as if unpacked\r\n\tvec2 up_s = get_coords( nindex_r, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_t = get_coords( nindex_g, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_p = get_coords( nindex_b, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tvec2 up_q = get_coords( nindex_a, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );\r\n\t\r\n\t// read four values from texture considering the new channels \r\n\tfloat r = get_channel_value( A, int(nchannel_r), up_s );\r\n\tfloat g = get_channel_value( A, int(nchannel_g), up_t );\r\n\tfloat b = get_channel_value( A, int(nchannel_b), up_p );\r\n\tfloat a = get_channel_value( A, int(nchannel_a), up_q );\r\n\t\r\n\tgl_FragColor = vec4( r, g, b, a );\r\n}\r\n",
		duplicate:			"void main( void ) {\r\n\tfloat A_value = get_channel_value( A, Achan, UVs );\r\n\tgl_FragColor = set_channel_value( OUTchan, A_value );\r\n}\r\n",
		duplicate_packed:	"void main( void ) {\t\r\n\tgl_FragColor = texture2D( A, UVs );\r\n}\r\n",
		pack:				"void main( void ) {\r\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\r\n\tfloat row_t = UVs.t;\r\n\t\r\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );\r\n\t\r\n\t// unpacked row and column index (columns are multiplied by 4 channels)\r\n\tfloat up_col = rowcol.x * 4.0;\r\n\tfloat up_row = rowcol.y / OUTshape.y + OUThalfp.y;\r\n\t\r\n\t// set a sequence of four indices\r\n\tvec4 seq_col_indices = vec4( up_col, up_col + 1.0, up_col + 2.0, up_col + 3.0 );\r\n\t\r\n\t// get the sequence of coordinates of unpacked texture\r\n\tvec2 up_s = vec2( seq_col_indices.x / up_cols + up_col_hstep, up_row );\r\n\tvec2 up_t = vec2( seq_col_indices.y / up_cols + up_col_hstep, up_row );\r\n\tvec2 up_p = vec2( seq_col_indices.z / up_cols + up_col_hstep, up_row );\r\n\tvec2 up_q = vec2( seq_col_indices.w / up_cols + up_col_hstep, up_row );\r\n\t\r\n\t// read four values from unpacked texture\r\n\tfloat r = get_channel_value( A, Achan, up_s );\r\n\tfloat g = get_channel_value( A, Achan, up_t );\r\n\tfloat b = get_channel_value( A, Achan, up_p );\r\n\tfloat a = get_channel_value( A, Achan, up_q );\r\n\r\n\tgl_FragColor = vec4( r, g, b, a );\r\n}\r\n",
		unpack:				"void main( void ) {\r\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\r\n\tfloat row_t = UVs.t;\r\n\r\n\tvec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );\r\n\tfloat p_col_index = floor( rowcol.x / 4.0 );\t\r\n\tfloat p_index = floor( rowcol.y * p_cols + p_col_index ); //  + 0.1\r\n\r\n\tint Achan = int( mod( rowcol.x, 4.0 ) );\r\n\tvec2 packed_st = get_coords( p_index, p_cols, p_col_hstep, OUTshape.y, OUThalfp.y );\r\n\tfloat value = get_channel_value( A, Achan, packed_st );\r\n\r\n\tgl_FragColor = set_channel_value( OUTchan, value );\r\n}\r\n",
		transpose:			"void main( void ) {\t\r\n\tfloat value = get_channel_value( A, Achan, vec2( UVs.y, UVs.x ) );\t\r\n\tgl_FragColor = set_channel_value( OUTchan, value );\r\n}"
	}
	
	// Shader sources
	this.shaders_src = {
		pass_through:		"// Quad pass-through\r\nprecision highp float;\r\n\r\nattribute vec3 position;\r\nattribute vec2 uv;\r\nvarying vec2   UVs;\r\n\r\nvoid main( void ) {\r\n\tgl_Position = vec4( position, 1.0 );\r\n\tUVs = uv;\r\n}\r\n"
	}

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
	
	var texture = this.setupTexture( 2, 2, null, false, gl.RGBA, gl.FLOAT )
	this.state.bindTexture( gl.TEXTURE_2D, texture )
	
	this.state.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.FLOAT, null )
	gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer )
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0 )

	if( gl.checkFramebufferStatus( gl.FRAMEBUFFER ) != gl.FRAMEBUFFER_COMPLETE )
		console.error( 'bindFramebuffer(): Framebuffer not complete' )

	gl.bindFramebuffer( gl.FRAMEBUFFER, null )
}

/* Create a texture for both input and output
 */
TCompute.prototype.setupTexture = function( M, N, data, packed, glFormat, glType ) {
	var gl = this.context
	
	var W = packed ? Math.ceil( N / 4 ) : N
	var H = M

	var texture = gl.createTexture()
	
	this.state.bindTexture( gl.TEXTURE_2D, texture )
	
	gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, false )
	gl.pixelStorei( gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false )
	//gl.pixelStorei( gl.UNPACK_ALIGNMENT, 4 )

	this.state.texImage2D( gl.TEXTURE_2D, 0, glFormat, W, H, 0, glFormat, glType, data )
	
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
		'uniform1f': 'float\t',
		'uniform1i': 'int\t\t',
		'sampler2D': 'sampler2D'
	}
	for ( var d in data ) {
		uniforms[ d ] = { type: type[ data[ d ].type ], comment: data[ d ].comment || '' }
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

	return uniforms
}

TCompute.prototype.generateProgram = function( program_name, debug ) {
	var gl = this.context
	
	var program_name = 'gen_' + program_name
	
	if ( !this.programs.hasOwnProperty( program_name ) ) {
		// VERTEX
		//vertex_src += '// ATTRIBUTES\r\n'
		//var attributes = this.gatherAttributes()

		// FRAGMENT
		//var frag_src = this.shaders_src.dynamic_fragment
		var frag_src = '// Shader: ' + program_name + ' ( generated )\r\n'
		frag_src += '\r\n'
		
		frag_src += '// SETTINGS\r\n'
		frag_src += 'precision highp float;\r\n'
		frag_src += '\r\n'
		
		frag_src += '// VARYINGS\r\n'
		frag_src += 'varying vec2\t\tUVs;\r\n'
		frag_src += '\r\n'
		//var varyings = this.gatherVaryings()
		
		frag_src += '// UNIFORMS\r\n'
		var uniforms = this.gatherUniforms()
		
		var str_uniforms = ''
		for ( var u in uniforms ) {
			var uniform = uniforms[ u ]
			var type = uniform.type
			var comment = uniform.comment || ''
			str_uniforms += 'uniform ' + type + '\t ' + u + ';\t' + comment + '\r\n'
		}
		frag_src += str_uniforms + '\r\n'		
		
		frag_src += '// FUNCTIONS\r\n'
		var str_functions = ''
		for ( var f in this.computePass.functions ) {
			str_functions += this.computePass.functions[ f ] + '\r\n'
		}
		frag_src += str_functions + '\r\n'
		
		frag_src += '// MAIN\r\n'
		frag_src += this.computePass.main + '\r\n'
		
		if ( debug ) console.log( frag_src )

		// Update cache
		this.shaders_src[ program_name ] = frag_src
		this.shaders[ program_name ] = this.setupShader( frag_src, gl.FRAGMENT_SHADER )
		this.programs[ program_name ] = this.setupProgram( this.shaders.pass_through, this.shaders[ program_name ] )
	}
	return this.programs[ program_name ]
}

TCompute.prototype.renderPass = function() {
	var gl = this.context
	
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
TCompute.prototype.readFloat = function( M, N, packed ) {
	var gl = this.context

	var W = packed ? Math.ceil( N / 4 ) : N
	var H = M
	var size = H * W * Float32Array.BYTES_PER_ELEMENT * 4

	// create destination buffer
	var rawbuffer = new ArrayBuffer( size )
	
	var readBuffer = new Float32Array( rawbuffer )
	gl.readPixels( 0, 0, W, H, gl.RGBA, gl.FLOAT, readBuffer )

	var sub_end = ( size - M * N * Float32Array.BYTES_PER_ELEMENT ) / 4
	
	// !!?? subarray() must use negative indexes of the relevant part else the full typed array is returned
	// Must use negative indexes
	return !packed || sub_end == 0 ? readBuffer : readBuffer.subarray( -size, -sub_end )
}

/*	float texture read, allows output as packed+deferred or unpacked
 */
TCompute.prototype.render = function( M, N, tensor, out, packed ) {
	// Objects
	var objects = this.buffers.framequad
	
	// Framebuffer
	var framebuffer = { width: N, height: M, texture: out, channel: out.channel || 0, bindChannel: false, bindShape: true }
	
	// Data
	var data = {}

	if ( packed ) {
		var W = Math.ceil( N / 4 )
		var H = M
		
		framebuffer.width = W
		
		var Wup = W * 4
		var Wuphs = ( 1 / Wup ) * 0.5
		
		var pad = Wup - N
		var Wup_padded = Wup - pad
		
		data = {
			up_cols: 		{ type: 'uniform1f', value: Wup, comment: '\t\t// Unpacked # columns' },
			up_col_hstep: 	{ type: 'uniform1f', value: Wuphs },
			up_cols_padded: { type: 'uniform1f', value: Wup_padded, comment: '// Unpacked # columns less padding\r\n' }
		}
	}

	// Textures
	var textures = {}
	
	textures.A = { type: 'sampler2D', value: tensor, bindChannel: true, bindShape: true }
	
	// GLSL Functions
	var functions = {}
	
	if ( packed ) {
		functions.get_indices 		= this.functions_src.get_indices
		functions.get_coords 		= this.functions_src.get_coords
		functions.get_channel_value = this.functions_src.get_channel_value
	}
	
	// GLSL Main
	var main = packed ? this.main_src.render_packed : this.main_src.render_unpacked
	
	// Shader generation
	var program_name = 'render' + ( packed ? '_packed' : '' )
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

	// GLSL Functions
	var functions = {}
	if ( !packed ) {
		functions.get_channel_value = this.functions_src.get_channel_value
		functions.set_channel_value = this.functions_src.set_channel_value
	}

	// GLSL Main
	var main = packed ? this.main_src.duplicate_packed : this.main_src.duplicate

	var program_name = 'duplicate' + ( packed ? '_packed' : '' )
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

	data = {
		p_cols: 		{ type: 'uniform1f', value: Math.ceil( W / 4 ) },
		p_col_hstep: 	{ type: 'uniform1f', value: ( 1 / Math.ceil( W / 4 ) ) * 0.5 }
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