vec2 get_coords( float index, float cols, float cols_hstep, float rows, float row_hstep ) {
	float iindex = index + cols_hstep; // + cols_hstep prevents padded bug
	float col_index = mod( iindex, cols );
	float row_index = floor( iindex / cols );

	return vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );
}
