const userRepository = require('../repositories/user.repository');
const { ApiError } = require('../utils/api-error');
const { signToken } = require('../utils/jwt');
const { hashPassword, verifyPassword } = require('../utils/password');

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const register = async ({ email, password, name }) => {
  const existingUser = await userRepository.findByEmail(email);

  if (existingUser) {
    throw new ApiError(409, 'Email is already registered');
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({ email, passwordHash, name });
  const token = signToken({ sub: user.id });

  return { user: toPublicUser(user), token };
};

const login = async ({ email, password }) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = signToken({ sub: user.id });

  return { user: toPublicUser(user), token };
};

const findAuthUser = async (id) => {
  const user = await userRepository.findById(id);

  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }

  return toPublicUser(user);
};

module.exports = {
  register,
  login,
  findAuthUser,
};
