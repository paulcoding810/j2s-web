import express from "express";
import morgan from "morgan";
import { exec } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(morgan("combined"));

// Routes

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/j2s", async (req, res) => {
  const j2sPath = join(__dirname, "j2s", "j2s");
  try {
    const javaCode = req.body.javaCode;

    if (!javaCode) {
      return res.status(400).json({
        success: false,
        error: "No Java code provided.",
      });
    }

    // Extract class name from the Java code
    const classNameMatch = javaCode.match(/public\s+class\s+(\w+)/);
    if (!classNameMatch) {
      return res.status(400).json({
        success: false,
        error: "Could not find a public class in the provided Java code.",
      });
    }

    const className = classNameMatch[1];
    const javaFileName = `${className}.java`;
    const javaFilePath = join(process.cwd(), javaFileName);

    // Write Java code to temporary file
    await writeFile(javaFilePath, javaCode, "utf8");

    let output = "";
    let error = "";

    try {
      // Compile Java code
      const compileResult = await execAsync(`javac ${javaFileName}`);
      const executeResult = await execAsync(`${j2sPath} ${javaFileName}`);
      output = executeResult.stdout;

      // Execute Java class
      // const executeResult = await execAsync(`java ${className}`);
      // output = executeResult.stdout;

      // if (executeResult.stderr) {
      //   error = executeResult.stderr;
      // }
    } catch (execError) {
      error = execError.stderr || execError.message;
      if (execError.stdout) {
        output = execError.stdout;
      }
    } finally {
      // Clean up temporary files
      try {
        await unlink(javaFilePath);
        const classFilePath = join(process.cwd(), `${className}.class`);
        await unlink(classFilePath);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError.message);
      }
    }

    // Send JSON response with results
    res.json({
      success: true,
      output: output || null,
      error: error || null,
    });
  } catch (error) {
    console.error("Error processing Java code:", error);
    res.status(500).json({
      success: false,
      error:
        "An internal server error occurred while processing your Java code.",
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
