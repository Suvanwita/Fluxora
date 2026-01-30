const { prisma } = require('../config/database');

const create = ({ email, passwordHash, name }) => {
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
    },
  });
};

const findByEmail = (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

const findById = (id) => {
  return prisma.user.findUnique({
    where: { id },
  });
};

module.exports = {
  create,
  findByEmail,
  findById,
};
