void main( void ) {
	float col_t = UVs.s;
	float row_t = UVs.t;

	vec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );
	float p_col_index = floor( rowcol.x / 4.0 );
	float p_index = floor( rowcol.y * p_cols + p_col_index ); //  + 0.1

	int Achan = int( mod( rowcol.x, 4.0 ) );
	vec2 packed_st = get_coords( p_index, p_cols, p_col_hstep, OUTshape.y, OUThalfp.y );
	float value = get_channel_value( A, Achan, packed_st );

	gl_FragColor = set_channel_value( OUTchan, value );
}
