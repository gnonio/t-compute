void main( void ) {
	// get the implied row and column from .t and .s of passed (output) texture coordinate.
	float col_t = UVs.s;
	float row_t = UVs.t;
	
	// get the implied row and column indices
	vec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );
	
	// this pixel index as if unpacked (up_cols = cols * 4.0)
	float index = rowcol.y * up_cols + rowcol.x * 4.0;
	
	// expanded indices per channel
	float index_r = index + 0.1;
	float index_g = index + 1.1;
	float index_b = index + 2.1;
	float index_a = index + 3.1;
	
	// number of padded elements(pixels) up to this index
	float pads_r = floor( index_r / up_cols_padded );
	float pads_g = floor( index_g / up_cols_padded );
	float pads_b = floor( index_b / up_cols_padded );
	float pads_a = floor( index_a / up_cols_padded );
	
	// new index accounting padding
	float nindex_r = index_r + pads_r * pad;
	float nindex_g = index_g + pads_g * pad;
	float nindex_b = index_b + pads_b * pad;
	float nindex_a = index_a + pads_a * pad;

	// new channel based on new index ( these get shifted )
	float nchannel_r = floor( mod( nindex_r, 4.0 ) );
	float nchannel_g = floor( mod( nindex_g, 4.0 ) );
	float nchannel_b = floor( mod( nindex_b, 4.0 ) );
	float nchannel_a = floor( mod( nindex_a, 4.0 ) );
	
	// can be optimized, at most 2 pixels should be read
	// get the sequence of coordinates of texture as if unpacked
	vec2 up_s = get_coords( nindex_r, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );
	vec2 up_t = get_coords( nindex_g, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );
	vec2 up_p = get_coords( nindex_b, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );
	vec2 up_q = get_coords( nindex_a, up_cols, up_col_hstep, OUTshape.y, OUThalfp.y );
	
	// read four values from texture considering the new channels 
	float r = get_channel_value( A, int(nchannel_r), up_s );
	float g = get_channel_value( A, int(nchannel_g), up_t );
	float b = get_channel_value( A, int(nchannel_b), up_p );
	float a = get_channel_value( A, int(nchannel_a), up_q );
	
	gl_FragColor = vec4( r, g, b, a );
}
