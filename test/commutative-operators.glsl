float x = 2e10 + (.2e2 + (1.e3 * (0xFaBc09 + 3)));
float y = 2e10 + (.2e2 - (1.e3 / (0xFaBc09 + 3)));
float z = 1 * (2 * 3);

mat3 m = mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
mat3 n = 2 * (vec3(1, 2, 3) * m);

bool a = 1. && (true && true);

bool b = 0. || (false || true);
