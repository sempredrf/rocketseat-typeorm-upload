// import csvParse from 'csv-parse';
// import fs from 'fs';
// import { getCustomRepository, getRepository, In } from 'typeorm';

// import TransactionsRepository from '../repositories/TransactionsRepository';
// import Transaction from '../models/Transaction';
// import Category from '../models/Category';

// interface CSVTransaction {
//   title: string;
//   type: 'income' | 'outcome';
//   value: number;
//   category: string;
// }

// class ImportTransactionsService {
//   async execute(filePath: string): Promise<Transaction[]> {
//     const contactsReadStream = fs.createReadStream(filePath);

//     const parsers = csvParse({
//       from_line: 2,
//     });

//     const transactions: CSVTransaction[] = [];
//     const categories: string[] = [];

//     const parseCSV = contactsReadStream.pipe(parsers);
//     parseCSV.on('data', async line => {
//       const { title, type, value, category } = line.map((cell: string) =>
//         cell.trim(),
//       );

//       if (!title || !type || !value || !category) return;

//       categories.push(category);
//       transactions.push({
//         title,
//         type,
//         value,
//         category,
//       });
//     });

//     await new Promise(resolve => parseCSV.on('end', resolve));

//     console.log(categories);
//     console.log(transactions);

//     const transactionsRepository = getCustomRepository(TransactionsRepository);
//     const categoriesRepository = getRepository(Category);

//     const existentCategories = await categoriesRepository.find({
//       where: {
//         title: In(categories),
//       },
//     });

//     const existentCategoriesTitle = existentCategories.map(
//       (category: Category) => category.title,
//     );

//     const addCategoryTitles = categories
//       .filter(category => !existentCategoriesTitle.includes(category))
//       .filter((value, index, self) => self.indexOf(value) === index);

//     const newCategories = categoriesRepository.create(
//       addCategoryTitles.map(title => ({ title })),
//     );

//     await categoriesRepository.save(newCategories);

//     const finalCategories = [...newCategories, ...existentCategories];

//     const createdTransactions = transactionsRepository.create(
//       transactions.map(transaction => ({
//         title: transaction.title,
//         type: transaction.type,
//         value: transaction.value,
//         category: finalCategories.find(
//           category => category.title === transaction.category,
//         ),
//       })),
//     );

//     await transactionsRepository.save(createdTransactions);
//     await fs.promises.unlink(filePath);

//     return createdTransactions;
//   }
// }

// export default ImportTransactionsService;

import parse from 'csv-parse';
import fs from 'fs';
import Transaction from '../models/Transaction';
import CreateTransactionService from './CreateTransactionService';
import AppError from '../errors/AppError';

interface TransactionDTO {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  private getTransactionsFromCSV(
    filePath: string,
  ): Promise<Array<TransactionDTO>> {
    const csvReadStream = fs.createReadStream(filePath);

    const parsers = parse({ delimiter: ', ', from_line: 2 });

    const parsed = csvReadStream.pipe(parsers);

    return new Promise((resolve, reject) => {
      const transactions: Array<TransactionDTO> = [];
      parsed
        .on('data', line => {
          const [title, type, value, category] = line;

          transactions.push({
            title,
            type,
            value,
            category,
          });
        })
        .on('error', () => {
          reject(new AppError('Error to read from csv file', 500));
        })
        .on('end', () => {
          resolve(transactions);
        });
    });
  }

  async execute(filePath: string): Promise<Transaction[]> {
    try {
      const createTransaction = new CreateTransactionService();

      let transactionsParsed: TransactionDTO[] = [];

      transactionsParsed = await this.getTransactionsFromCSV(filePath);

      const transactionsPersisted: Transaction[] = [];

      // eslint-disable-next-line no-restricted-syntax
      for (const transaction of transactionsParsed) {
        // eslint-disable-next-line no-await-in-loop
        const transactionSaved = await createTransaction.execute(transaction);
        transactionsPersisted.push(transactionSaved);
      }

      await fs.promises.unlink(filePath);

      return transactionsPersisted;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
      throw new AppError('Error to read and save transactions', 500);
    }
  }
}

export default ImportTransactionsService;
