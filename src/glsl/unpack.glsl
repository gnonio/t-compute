// PACKED+UNDEFERRED TO UNPACKED
precision highp float;

varying vec2		UVs;			// texture coords of row/column to calculate

uniform float		cols;			// number of columns
uniform float		col_hstep;		// half step in texture space
uniform float		rows;			// number of rows
uniform float		row_hstep;		// half step in texture space

uniform float		p_cols;			// number of packed columns
uniform float		p_col_hstep;	// half step in texture space

uniform sampler2D	A;				// texture with single channel data from A

uniform int			write_channel;	// channel to write texture to

#pragma glslify: get_indices = require(./get_indices)
#pragma glslify: get_coords = require(./get_coords)
#pragma glslify: get_channel_value = require(./get_channel_value)
#pragma glslify: set_channel_value = require(./set_channel_value)

void main(void) {
	// get the implied row and column from .t and .s of passed (output) texture coordinate.
	float col_t = UVs.s;
	float row_t = UVs.t;
	
	vec2 rowcol = get_indices( col_t, cols, row_t, rows );
	float p_col_index = floor( rowcol.x / 4.0 );	
	float p_index = floor( rowcol.y * p_cols + p_col_index ); //  + 0.1
	
	int A_channel = int( mod( rowcol.x, 4.0 ) );
	vec2 packed_st = get_coords( p_index, p_cols, p_col_hstep, rows, row_hstep );	
	float value = get_channel_value( A, A_channel, packed_st );
	
	gl_FragColor = set_channel_value( write_channel, value );
}
