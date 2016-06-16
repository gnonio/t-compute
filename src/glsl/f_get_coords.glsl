vec2 get_coords( float index, float cols, float cols_halfp, float rows, float row_halfp ) {
	float col_index = modulo( index, cols ); // custom mod function addressing float division rounding error
	float row_index = floor( ( index + 0.5 ) / cols ); // as above
	
	return vec2( col_index * cols_halfp * 2.0 + cols_halfp, row_index * row_halfp * 2.0 + row_halfp );
}
