const express = require('express');
const app = express();
const port = 8000;
const cors = require("cors");
const { Client } = require("pg");
const yup = require('yup');

async function createDatabaseIfNotExists() {
    const client = new Client({
        user: "postgres",
        password: "1234",
        host: "localhost",
        port: 5432,
    });

    try {
        await client.connect();
        const checkDbQuery = "SELECT 1 FROM pg_database WHERE datname = 'todo_crud_api'";
        const result = await client.query(checkDbQuery);
        if (result.rowCount === 0) {
            await client.query('CREATE DATABASE todo_crud_api');
            console.log("Database 'todo_crud_api' created.");
        } else {
            console.log("Database 'todo_crud_api' already exists.");
        }
    } catch (err) {
        console.error("Error checking/creating the database:", err);
    } finally {
        await client.end();
    }
}

const client = new Client({
    user: "postgres",
    password: "1234",
    host: "localhost",
    port: 5432,
    database: "todo_crud_api",
});

async function createTodosTable() {
    try {
        await client.connect();
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS todos (
                id serial PRIMARY KEY,
                text varchar(255),
                isCompleted boolean
            )
        `;
        await client.query(createTableQuery);
        console.log("Table 'todos' created.");
    } catch (err) {
        console.error("Error creating the 'todos' table:", err);
    }
}

createDatabaseIfNotExists();
createTodosTable();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());


const todoBodySchema = yup.object().shape({
    isCompleted: yup.boolean().required(),
    text: yup.string().required(),
});

const idSchema = yup.object().shape({
    id: yup.number().positive().integer().required()
})

function getValidate(schema) {
    return async (req, res, next) => {
        try {
            await schema.validate(req.body);
            next();
        } catch (err) {
            res.status(400).json({
                status: "Bad request- Status code : 400",
                message: err.message
            });

        }
    }
}

function getValidateId(schema) {
    return async (req, res, next) => {
        try {
            await schema.validate({ id: req.params.id });
            next();
        } catch (err) {
            res.status(400).json({
                status: "Bad request- Status code : 400",
                message: err.message
            });

        }
    }
}

app.post('/todos', getValidate(todoBodySchema), async (req, res) => {
    try {
        const data = req.body;
        const result = await client.query('INSERT INTO todos (isCompleted, text) VALUES ($1, $2) RETURNING *', [data.isCompleted, data.text]);
        const insertedTodo = result.rows[0];
        res.status(200).json({ text: "Data saved to the database", insertedTodo });
    } catch (err) {
        res.status(403).json({
            status: "403 Forbidden",
            message: err.message
        })
    }
});

app.get('/todos', async (req, res) => {
    try {
        const query = 'SELECT id, text, isCompleted FROM todos';
        const result = await client.query(query);
        const todos = result.rows;
        res.status(200).json({ todos });
    } catch (err) {
        res.status(403).json({
            status: "403 Forbidden",
            message: err.message
        })
    }
});

app.get('/todos/:id', getValidateId(idSchema), async (req, res) => {
    try {
        const id = req.params.id
        const result = await client.query('SELECT id, text, isCompleted FROM todos WHERE id=$1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "not found" });
        } else {
            const todos = result.rows[0];
            res.status(200).json(todos);
        }
    } catch (err) {
        res.status(403).json({
            status: "403 Forbidden",
            message: err.message
        })
    }
});

app.put('/todos/:id', getValidateId(idSchema), getValidate(todoBodySchema), async (req, res) => {
    try {
        const id = req.params.id;
        const { text, isCompleted } = req.body;
        const updateQuery = `
            UPDATE todos
            SET text = $1, isCompleted = $2
            WHERE id = $3
        `;

        const result = await client.query(updateQuery, [text, isCompleted, id]);
        const updatedTodo = await client.query('SELECT * FROM todos WHERE id=$1', [id])

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "not found" });
        } else {
            res.status(200).json(updatedTodo.rows[0]);
        }
    } catch (err) {
        res.status(403).json({
            status: "403 Forbidden",
            message: err.message
        })
    }
});

app.delete('/todos/:id', getValidateId(idSchema), async (req, res) => {
    try {
        const id = req.params.id
        const result = await client.query('DELETE FROM todos WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "not found" });
        } else {
            res.status(200).json({ message: "Todo " + id + " deleted" });
        }

    } catch (err) {
        res.status(403).json({
            status: "403 Forbidden",
            message: err.message
        })
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});