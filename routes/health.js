export default function (app) {

    app.get("/health", async (req, res) => {
        res.send({ status: "Share the Load API is running" });
    });

}