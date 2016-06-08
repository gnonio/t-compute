void main( void ) {
	// get the implied row and column from .t and .s of passed (output) texture coordinate.
	float col_t = UVs.s;
	float row_t = UVs.t;

	// get the implied row and column indices
	vec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );

	// unpacked index (columns are multiplied by 4 channels)
	float up_index = rowcol.y * OUTshape.x * 4.0 + rowcol.x * 4.0;

	// set a sequence of four indices
	vec4 seq_indices = vec4( up_index, up_index + 1.0, up_index + 2.0, up_index + 3.0 );

	// get the sequence of coordinates of unpacked texture
	vec2 up_s = get_coords( seq_indices.x, up_cols_padded, up_col_hstep, OUTshape.y, OUThalfp.y );
	vec2 up_t = get_coords( seq_indices.y, up_cols_padded, up_col_hstep, OUTshape.y, OUThalfp.y );
	vec2 up_p = get_coords( seq_indices.z, up_cols_padded, up_col_hstep, OUTshape.y, OUThalfp.y );
	vec2 up_q = get_coords( seq_indices.w, up_cols_padded, up_col_hstep, OUTshape.y, OUThalfp.y );

	// read four values from unpacked texture
	float r = get_channel_value( A, Achan, up_s );
	float g = get_channel_value( A, Achan, up_t );
	float b = get_channel_value( A, Achan, up_p );
	float a = get_channel_value( A, Achan, up_q );

	gl_FragColor = vec4( r, g, b, a );
}
