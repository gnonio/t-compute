void main( void ) {
	// get the implied row and column from .t and .s of passed (output) texture coordinate.
	float col_t = UVs.s;
	float row_t = UVs.t;
	
	// get the implied row and column indices
	vec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );
	
	// unpacked row and column index (columns are multiplied by 4 channels)
	float up_col = rowcol.x * 4.0;
	float up_row = rowcol.y / OUTshape.y + OUThalfp.y;
	
	// set a sequence of four indices
	vec4 seq_col_indices = vec4( up_col, up_col + 1.0, up_col + 2.0, up_col + 3.0 );
	
	// get the sequence of coordinates of unpacked texture
	vec2 up_s = vec2( seq_col_indices.x / up_cols + up_col_hstep, up_row );
	vec2 up_t = vec2( seq_col_indices.y / up_cols + up_col_hstep, up_row );
	vec2 up_p = vec2( seq_col_indices.z / up_cols + up_col_hstep, up_row );
	vec2 up_q = vec2( seq_col_indices.w / up_cols + up_col_hstep, up_row );
	
	// read four values from unpacked texture
	float r = get_channel_value( A, Achan, up_s );
	float g = get_channel_value( A, Achan, up_t );
	float b = get_channel_value( A, Achan, up_p );
	float a = get_channel_value( A, Achan, up_q );

	gl_FragColor = vec4( r, g, b, a );
}
