void main( void ) {
	float row_t = UVs.y;
	float col_t = UVs.x;
	
	vec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );
	
	float A_col = rowcol.x;
	float A_row = rowcol.y;
	
	float A_value = 1.0;
	if ( A_col < A_cols ) {
		float A_index = A_row * A_cols + A_col;
		
		vec2 A_st = get_coords( A_index, A_cols, A_col_hstep, OUTshape.y, OUThalfp.y );

		A_value = get_channel_value( A, Achan, A_st );
	}

	gl_FragColor = set_channel_value( OUTchan, A_value );
}
