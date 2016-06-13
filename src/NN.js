/**
 * @author gnonio / http://www.euclidiana.pt
 *
 * Merged from weblas unpacked plugin ( https://github.com/gnonio/weblas-unpacked )
 *
 * Neural Network computations
 * ReLU, Append bias
 *
 */

var fs = require('fs')

try {
	var tcompute = TCompute === undefined
} catch ( error ) { console.info( 'NN', error ) }

try {
	var tensor = Tensor === undefined
} catch ( error ) { console.info( 'NN', error ) }

//	ReLU
//	Shader
var _relu = fs.readFileSync('./src/glsl/nn/m_relu.glsl', 'utf8')

//	WebGL
function relu_gl( M, N, tensorA, result ) {
	var objects = this.buffers.framequad
	
	var framebuffer = { width: N, height: M, texture: result.texture, channel: result.channel, bindChannel: true, bindShape: true }
	
	var data = {}

	var textures = {}	
	textures.A = { type: 'sampler2D', value: tensorA, bindChannel: true, bindShape: true }
	
	// GLSL Functions
	var functions = {}
	functions.get_channel_value = this.functions_src.get_channel_value
	functions.set_channel_value = this.functions_src.set_channel_value

	// GLSL Main
	var main = _relu

	var program_name = 'relu'
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, true )
	
	this.renderPass()
}
TCompute.prototype.relu = relu_gl

//	Tensor
function relu_fnc( A ) {
	gl = window.tcompute
	
	if ( A.packed ) throw new Error('relu(): Only unpacked textures supported.')
		
	var M = A.shape[0],
		N = A.shape[1]
		
	// create new tensor to hold result
	var relu = new Tensor( [M, N], null )
	
	// invoke shader
	gl.relu( M, N, A, relu )

	return relu
}
module.exports.relu = relu_fnc

//	Append bias column
//	might be useful to generalize this further (ie. scale bias, or arbitrary value)
//	Shader
var _append_bias 		= fs.readFileSync('./src/glsl/nn/m_append_bias.glsl', 'utf8')

//	WebGL
function append_bias_gl( M, N, tensorA, result ) {
	var objects = this.buffers.framequad
	
	var framebuffer = { width: N, height: M, texture: result.texture, channel: result.channel, bindChannel: true, bindShape: true }
	
	var data = {}

	var W = N
	var H = M
	
	data = {		
		A_cols: 		{ type: 'uniform1f', value: W - 1 },
		A_col_hstep: 	{ type: 'uniform1f', value: ( 1 / (W - 1) ) * 0.5 }
	}
	
	var textures = {}
	textures.A = { type: 'sampler2D', value: tensorA, bindChannel: true, bindShape: false }

	// GLSL Functions
	var functions = {}
	functions.get_indices 		= this.functions_src.get_indices
	functions.get_coords 		= this.functions_src.get_coords
	functions.get_channel_value = this.functions_src.get_channel_value
	functions.set_channel_value = this.functions_src.set_channel_value

	// GLSL Main
	var main = _append_bias

	var program_name = 'append_bias'

	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, true )
	
	this.renderPass()
}
TCompute.prototype.append_bias = append_bias_gl

//	Tensor
function append_bias_fnc( A ) {
	gl = window.tcompute
	
	if ( A.packed ) throw new Error('append_bias(): Only unpacked textures supported.')
		
	var M = A.shape[0],
		N = A.shape[1],
		BiasN = N + 1
		
	// create new tensor to hold result
	var bias = new Tensor( [M, BiasN], null )
	
	// invoke shader
	gl.append_bias( M, BiasN, A, bias )

	return bias
}
module.exports.append_bias = append_bias_fnc