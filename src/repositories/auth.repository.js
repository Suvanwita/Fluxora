const { prisma } = require('../config/db');

const createUser = ({ email, passwordHash, name }) => {
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
    },
  });
};

const findUserByEmail = (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

const findUserById = (id) => {
  return prisma.user.findUnique({
    where: { id },
  });
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
};
