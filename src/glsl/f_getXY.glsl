vec2 getXY( vec2 uv, vec2 shape ) {
	float col_index = floor( uv.s * shape.x );
	float row_index = floor( uv.t * shape.y );

	return vec2( col_index, row_index );
}
